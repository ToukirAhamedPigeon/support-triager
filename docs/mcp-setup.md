# Step 10: GitHub + Slack MCP Connections

Both are connected via the Anthropic Messages API's **native remote-MCP connector** (`mcp_servers` + `mcp_toolset` tools, beta `mcp-client-2025-11-20`), not a locally-run MCP process — both GitHub and Slack publish official, hosted MCP server endpoints, so Anthropic's infrastructure talks to them directly and resolves tool calls server-side (the same "no client-side execution loop" shape as the Step 9 web_search tool). Implementation: `src/mcp/servers.ts` (connection config) + `src/mcp/act.ts` (the action-taking call).

## GitHub — `https://api.githubcopilot.com/mcp/`

No separate setup needed: `src/mcp/servers.ts` reuses the already-authenticated `gh` CLI token (`gh auth token`) as the `authorization_token`, since it already carries the `repo` scope that issue creation/lookup needs. Override with a dedicated token via `GITHUB_MCP_TOKEN` in `.env` if you'd rather not reuse the CLI credential.

## Slack — `https://mcp.slack.com/mcp`

This one needs a one-time setup in your Slack workspace (the account holder has to do this — it involves your own workspace admin settings):

1. Go to **api.slack.com/apps → Create New App → From scratch**, in the workspace created for this project.
2. In the app's settings, go to **Features → Agents & AI Apps** and toggle **Model Context Protocol** to **ON**. (This is the step that's easy to miss — without it, OAuth can look configured but Slack rejects MCP requests at runtime.)
3. Install the app to the workspace to complete the OAuth authorization; Slack issues an OAuth token as part of that flow.
4. Add that token to `D:\support-triager\.env` yourself (same rule as the Anthropic key — never paste it into chat):
   ```
   SLACK_MCP_TOKEN=xoxp-...
   ```

`src/mcp/servers.ts` only adds the Slack server to the connector list once `SLACK_MCP_TOKEN` is present, so the GitHub half can be demoed independently while Slack setup is pending.

## What the demo does (`npm run mcp:demo [eval-set id]`)

Triages one message (default: #18, the critical production-integration outage — a case that should genuinely produce both a GitHub issue and a Slack notification), then calls `fileAndNotify` (`src/mcp/act.ts`), which:
- Searches `${MCP_DEMO_GITHUB_REPO:-ToukirAhamedPigeon/support-triager}`'s issues for an existing match; if none, files one with the customer's message + triage summary.
- Posts one Slack message to the channel mapped from the ticket's team (`#eng-alerts`, `#billing-support`, `#customer-success`, `#security-incidents`, `#sales`).

## Status

**GitHub: confirmed live end-to-end.** `npm run mcp:demo 18` (the critical production-integration-outage message) triaged the message, searched existing issues (none found), and created a real issue: [ToukirAhamedPigeon/support-triager#1](https://github.com/ToukirAhamedPigeon/support-triager/issues/1) — title, labels (`critical`, `engineering`, `outage`), and a body containing the customer message and triage summary, all written by Claude through the GitHub MCP connection. Claude also made a small real mistake mid-run (an accidental placeholder comment) and self-corrected transparently in a follow-up comment rather than silently ignoring it — worth keeping as an honest example rather than a clean re-run.

**Slack: correctly deferred, not faked.** Since `SLACK_MCP_TOKEN` wasn't set yet (setup still pending on the account holder's side), the Slack server was never added to the connector list — no Slack tool existed for Claude to call. Rather than fabricate success, Claude explicitly reported it couldn't complete the Slack half, explained why, and drafted the message that *would* be posted once the tool is available. That's the correct behavior for a missing tool, and worth noting as a genuine (not staged) example of the model not overclaiming an action it didn't take.
