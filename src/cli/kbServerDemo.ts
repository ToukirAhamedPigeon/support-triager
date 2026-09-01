import { makeClient, HAIKU } from "../lib/client.js";
import { connectStdioMcpServer } from "../mcp/bridge.js";

/** Step 11 live demo: Claude discovers search_kb via the bridge and decides
 * to call it, proving the custom MCP server is reachable through a normal
 * Messages API tool-use turn (not just the protocol-level test in
 * tests/kbServer.test.ts). */
const bridge = await connectStdioMcpServer(process.execPath, ["node_modules/tsx/dist/cli.mjs", "src/mcp/kbServer.ts"]);
console.log("Discovered tools:", bridge.tools.map((t) => t.name));

const client = makeClient();
const messages: Parameters<typeof client.messages.create>[0]["messages"] = [
  { role: "user", content: "A customer is asking: 'Could you point me to documentation on how to set up SSO for our organization?' Find the relevant internal article before answering." },
];

let response = await client.messages.create({
  model: HAIKU,
  max_tokens: 512,
  tools: bridge.tools,
  messages,
});

while (response.stop_reason === "tool_use") {
  messages.push({ role: "assistant", content: response.content });
  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") break;

  console.log(`\nClaude called ${toolUse.name}(${JSON.stringify(toolUse.input)})`);
  const result = await bridge.callTool(toolUse.name, toolUse.input as Record<string, unknown>);
  console.log("Tool result:", result);

  messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, content: result }] });
  response = await client.messages.create({ model: HAIKU, max_tokens: 512, tools: bridge.tools, messages });
}

const text = response.content.find((b) => b.type === "text");
console.log("\nFinal answer:", text?.type === "text" ? text.text : "(no text block)");

await bridge.close();
