import { describe, it, expect, afterAll } from "vitest";
import { connectStdioMcpServer, type McpBridge } from "../src/mcp/bridge";

/**
 * Real end-to-end MCP protocol test — spawns the actual search_kb server as
 * a subprocess over stdio, same as Claude's tool-use loop would discover and
 * call it through. No Anthropic API involved, so this runs without credits.
 */
let bridge: McpBridge;

describe("search_kb MCP server (stdio)", () => {
  it("is discoverable with the expected tool schema", async () => {
    // Spawn via the node binary directly (not "npx") — child_process.spawn on
    // Windows can't resolve the npx.cmd shim without shell:true, which the
    // MCP SDK's StdioClientTransport doesn't set.
    bridge = await connectStdioMcpServer(process.execPath, ["node_modules/tsx/dist/cli.mjs", "src/mcp/kbServer.ts"]);
    expect(bridge.tools).toHaveLength(1);
    expect(bridge.tools[0].name).toBe("search_kb");
    expect(bridge.tools[0].input_schema.properties).toHaveProperty("query");
  }, 30000);

  it("returns the matching KB article for a relevant query", async () => {
    const result = await bridge.callTool("search_kb", { query: "sso" });
    expect(result).toContain("kb_sso_setup");
    expect(result).toContain("identity provider");
  });

  it("returns a no-match message for an irrelevant query", async () => {
    const result = await bridge.callTool("search_kb", { query: "quantum teleportation" });
    expect(result).toMatch(/no matching/i);
  });

  afterAll(async () => {
    await bridge?.close();
  });
});
