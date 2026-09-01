# Step 11: Custom MCP Server

**`support-kb`** (`src/mcp/kbServer.ts`) — one tool, `search_kb`, that searches a small internal knowledge base (`src/mcp/kbData.ts`) for articles relevant to a customer's issue, so the triager can check for a known resolution before creating a ticket. This is specific to this support workflow — it's not a generic utility, and it's distinct from Step 9's web search (public internet) and the four data tools in `src/tools/` (customer/order/ticket records).

## Transport: stdio

Chosen over HTTP because this server has exactly one consumer (this project's own orchestrator process) running on the same machine, started and stopped alongside it — not a shared service other systems reach over a network:

- **No auth/TLS surface to build.** stdio's trust boundary is "whoever can spawn the child process," which is already true of any code running in this project — there's no separate credential or network exposure to secure, unlike an HTTP server that would need to decide who's allowed to call it.
- **Lifecycle matches the consumer.** The bridge (`src/mcp/bridge.ts`) spawns the server when it's needed and closes it when done — no server to keep running, deploy, or health-check independently of the process that uses it.
- **This is exactly MCP's stdio use case**, and the inverse of Step 10: GitHub's and Slack's MCP servers are shared, multi-tenant services reached over HTTP by many different clients (which is why *they* need OAuth and a URL) — a single-consumer local companion tool is the case stdio is for.

If this KB search needed to be shared across multiple services, or scaled independently, or accessed by something other than this codebase, HTTP would be the right call — none of that applies here.

## Confirming discovery + calling

Two levels of proof, deliberately separate so the protocol-level one doesn't depend on API credits:

1. **Protocol-level (`tests/kbServer.test.ts`, runs now, no Anthropic API needed):** spawns the real server as a subprocess, calls `listTools()` and confirms `search_kb` is discovered with the expected schema, then calls it and confirms the right KB article comes back for a relevant query and a clean "no match" for an irrelevant one. This is genuine end-to-end MCP protocol traffic over a real stdio pipe, not a mock.
2. **Live, through Claude (`npm run kb:demo`, needs API credits):** connects the bridge, passes its tools into a real `client.messages.create` call with a how-to-style customer message, and lets Claude decide to call `search_kb` on its own — proving the tool is genuinely discoverable and callable through the normal Messages API tool-use loop, the same mechanism the four local tools in `src/tools/` use.

## Status

_Level 1 passes today (see `tests/kbServer.test.ts`). Level 2 is code-complete, pending Anthropic API credits — see `REPORT.md`._
