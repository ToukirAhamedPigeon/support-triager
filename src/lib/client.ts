import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

export function makeClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set (add it to .env)");
  }
  return new Anthropic({
    apiKey,
    defaultHeaders: workspaceId ? { "anthropic-workspace-id": workspaceId } : undefined,
  });
}

export const HAIKU = "claude-haiku-4-5";
export const SONNET = "claude-sonnet-5";
