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

**Slack: confirmed live end-to-end**, after two genuine real-world hiccups worth keeping in the record rather than smoothing over:

1. **First attempt** (before `SLACK_MCP_TOKEN` was set): the Slack server was never added to the connector list, so no Slack tool existed. Rather than fabricate success, Claude explicitly reported it couldn't complete the Slack half and drafted the message that would be posted once the tool existed — correct behavior for a genuinely missing tool.
2. **Second attempt** (token added, real Slack tools now available — `slack_send_message`, `slack_search_channels`, `slack_list_user_channels`): Claude tried the production channel mapping's `#eng-alerts`, which doesn't exist in this small demo workspace (it only has `#all-pigeonic`, `#social`, `#new-channel`). It got a real `channel_not_found` error, searched and listed real channels to check, found none matching, and **asked for a valid channel instead of guessing or fabricating a post** — another case of not overclaiming.
3. **Fix:** added `MCP_DEMO_SLACK_CHANNEL` (`src/mcp/act.ts`) to override the per-team channel map to one channel that exists, for this small workspace — the per-team mapping stays the documented production design. Re-run succeeded: a real message was posted to `#all-pigeonic`, confirmed by both the tool's returned `message_link` and a screenshot of the actual channel.

![Live Slack message posted through the MCP connection](../screenshots/slack-message-live.png)
