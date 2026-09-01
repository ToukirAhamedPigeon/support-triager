import { execFileSync } from "node:child_process";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic's native remote-MCP connector (Messages API `mcp_servers` +
 * `mcp_toolset`, beta `mcp-client-2025-11-20`). Both GitHub's and Slack's
 * official MCP servers are hosted, HTTP-reachable endpoints, so Anthropic's
 * infrastructure connects to them directly and resolves tool calls server-side
 * — the same "no client-side execution loop" shape as the web_search tool in
 * Step 9. No local MCP client, no stdio process, on our side for Step 10.
 */

function githubToken(): string {
  const fromEnv = process.env.GITHUB_MCP_TOKEN;
  if (fromEnv) return fromEnv;
  // Reuse the already-authenticated `gh` CLI token rather than requiring a
  // second credential — it already carries the `repo` scope MCP issue
  // creation needs.
  return execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim();
}

export function mcpServers(): Anthropic.Beta.BetaRequestMCPServerURLDefinition[] {
  const slackToken = process.env.SLACK_MCP_TOKEN;
  const servers: Anthropic.Beta.BetaRequestMCPServerURLDefinition[] = [
    {
      type: "url",
      name: "github",
      url: "https://api.githubcopilot.com/mcp/",
      authorization_token: githubToken(),
    },
  ];
  if (slackToken) {
    servers.push({
      type: "url",
      name: "slack",
      url: "https://mcp.slack.com/mcp",
      authorization_token: slackToken,
    });
  }
  return servers;
}

export function mcpToolsets(serverNames: string[]): Anthropic.Beta.BetaMCPToolset[] {
  return serverNames.map((name) => ({ type: "mcp_toolset", mcp_server_name: name }));
}
