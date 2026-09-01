import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * Generic MCP-client bridge: connects to any stdio MCP server, exposes its
 * tools in Anthropic's Tool shape (so they can be merged into a normal tools
 * array), and dispatches calls back to the server. This is what makes an
 * MCP server's tools something Claude can "discover and call" through the
 * regular Messages API tool-use loop, the same way the four local tools in
 * src/tools/ work — just backed by a subprocess instead of local functions.
 */
export interface McpBridge {
  tools: Anthropic.Tool[];
  callTool(name: string, input: Record<string, unknown>): Promise<string>;
  close(): Promise<void>;
}

export async function connectStdioMcpServer(command: string, args: string[]): Promise<McpBridge> {
  const transport = new StdioClientTransport({ command, args });
  const client = new Client({ name: "support-triager", version: "1.0.0" });
  await client.connect(transport);

  const { tools: mcpTools } = await client.listTools();
  const tools: Anthropic.Tool[] = mcpTools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }));

  return {
    tools,
    async callTool(name, input) {
      const result = await client.callTool({ name, arguments: input });
      const content = result.content as Array<{ type: string; text?: string }>;
      return content
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("\n");
    },
    async close() {
      await client.close();
    },
  };
}
