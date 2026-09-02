import type Anthropic from "@anthropic-ai/sdk";
import { SONNET } from "../lib/client.js";
import { mcpServers, mcpToolsets } from "./servers.js";
import type { TriageInput, TriageResult } from "../triager/types.js";

const GITHUB_REPO = process.env.MCP_DEMO_GITHUB_REPO ?? "ToukirAhamedPigeon/support-triager";

// Production design routes each team to its own channel. For a small demo
// workspace that doesn't have all five channels provisioned yet,
// MCP_DEMO_SLACK_CHANNEL overrides every team to one channel that exists.
const DEMO_CHANNEL_OVERRIDE = process.env.MCP_DEMO_SLACK_CHANNEL;
const TEAM_SLACK_CHANNEL: Record<string, string> = DEMO_CHANNEL_OVERRIDE
  ? {
      billing_support: DEMO_CHANNEL_OVERRIDE,
      engineering: DEMO_CHANNEL_OVERRIDE,
      customer_success: DEMO_CHANNEL_OVERRIDE,
      security_team: DEMO_CHANNEL_OVERRIDE,
      sales_team: DEMO_CHANNEL_OVERRIDE,
    }
  : {
      billing_support: "#billing-support",
      engineering: "#eng-alerts",
      customer_success: "#customer-success",
      security_team: "#security-incidents",
      sales_team: "#sales",
    };

function actSystemPrompt(): string {
  return `You are the action-taking stage of a support triager (Stage 2 — see docs/model-selection.md). You're given an already-triaged support ticket and must take the appropriate follow-up action(s) using the GitHub and Slack tools available.

Rules:
- If the topic is "bug", "outage", or "integration" and team is "engineering": search the ${GITHUB_REPO} repo's issues first for an existing issue covering the same problem; if none exists, create one with a clear title and a body containing the customer's message and the triage summary. If a matching issue already exists, do not create a duplicate — just note that.
- Always post one Slack message to the channel matching the ticket's team (mapping: ${JSON.stringify(TEAM_SLACK_CHANNEL)}) summarizing: urgency, topic, one-line summary, and the GitHub issue link if one was filed.
- Take the minimum actions needed — at most one GitHub issue, at most one Slack message. Do not post to multiple channels or file multiple issues for one ticket.`;
}

export interface ActOutcome {
  content: Anthropic.Beta.BetaContentBlock[];
  stopReason: string | null;
}

/** Step 10: drive the GitHub + Slack MCP connections for one triaged ticket. */
export async function fileAndNotify(
  client: Anthropic,
  input: TriageInput,
  result: TriageResult,
): Promise<ActOutcome> {
  const servers = mcpServers();
  const serverNames = servers.map((s) => s.name);

  const response = await client.beta.messages.create({
    model: SONNET,
    max_tokens: 2048,
    betas: ["mcp-client-2025-11-20"],
    mcp_servers: servers,
    tools: mcpToolsets(serverNames),
    system: actSystemPrompt(),
    messages: [
      {
        role: "user",
        content: `Triage result: ${JSON.stringify(result)}\n\nCustomer: ${input.customerEmail}\nOriginal message:\n${input.message}\n\nTake the appropriate action(s) now.`,
      },
    ],
  });

  return { content: response.content, stopReason: response.stop_reason };
}
