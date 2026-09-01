import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY not set (checked process.env after loading .env)");
  process.exit(1);
}

const client = new Anthropic({
  apiKey,
  defaultHeaders: workspaceId ? { "anthropic-workspace-id": workspaceId } : undefined,
});

const response = await client.messages.create({
  model: "claude-haiku-4-5",
  max_tokens: 100,
  messages: [{ role: "user", content: "Reply with exactly the words: API access confirmed." }],
});

console.log("Model:", response.model);
console.log("Stop reason:", response.stop_reason);
console.log("Text:", response.content.map((b) => (b.type === "text" ? b.text : "")).join(""));
console.log("Usage:", response.usage);
