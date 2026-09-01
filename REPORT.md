# Support Triager — Assignment Report

**Repo:** https://github.com/ToukirAhamedPigeon/support-triager

This report covers all 12 steps. Sections are labeled to match the required submission items (a)–(h). **Live-execution status:** Steps 1–11 are fully implemented, typechecked, and tested wherever they don't require live Anthropic API credits (mocked-client tests for the tool-use engines, a real subprocess test for the custom MCP server). Everything that needs a real Anthropic API call (Steps 1, 5–10 live runs, 12) is blocked on account credits — see "Live execution status" at the end.

---

## Step 1: API access

Confirmed working end-to-end (`src/cli/testApiAccess.ts`) after resolving two real setup issues along the way: this account's API key is workspace-scoped, so requests need an explicit `anthropic-workspace-id` header (`src/lib/client.ts` sets it from `ANTHROPIC_WORKSPACE_ID`); and the account's "Evaluation access" plan has $0 credit by default (no card-free trial was actually granted) — confirmed via a real `401`/`400` credit-balance error, not assumed. Every script in this repo (`src/lib/client.ts`) is ready to run the instant credits are added; see "Live execution status."

---

## (a) Step 2: Evaluation set

Full data: [`docs/eval-set.json`](docs/eval-set.json), methodology: [`docs/eval-set.md`](docs/eval-set.md).

20 hand-written, hand-labeled support messages (urgency/topic/team, labeled *before* any triager code existed), covering all 10 topics and all 5 teams, realistic urgency spread (3 critical / 6 high / 8 normal / 3 low), each carrying a `customer_email` tied to one of 8 mock customer accounts (`src/data/customers.ts`) so the tool-use tests have real data to act on. Two deliberately hard cases (#19, #20) are called out for later error analysis.

---

## (b) Step 3: Triage schema

Full spec: [`docs/schema.md`](docs/schema.md), implementation: `src/triager/schema.ts` (system prompt) + `src/triager/types.ts`/`schema.ts` (zod validation).

```json
{
  "urgency": "critical | high | normal | low",
  "topic": "billing | bug | account_access | how_to | feature_request | outage | security | integration | sales | other",
  "team": "billing_support | engineering | customer_success | security_team | sales_team",
  "confidence": 0.0,
  "needs_human_review": false,
  "summary": "one sentence"
}
```

Uncertainty rule: never leave a field blank or invent a value outside the enums — pick the single most likely topic/team, set confidence honestly low, set `needs_human_review: true`, and default `urgency` to `normal` rather than guessing `critical` (a false-critical wastes a human's time on nothing, worse than a missed one a human catches on review).

---

## (c) Step 4: Model tier selection

Full justification: [`docs/model-selection.md`](docs/model-selection.md).

- **Stage 1 (high-volume classification): Claude Haiku 4.5.** Bounded task (closed enums, fixed tool signatures) — extra reasoning depth is wasted; this is the path every message takes and a human watches stream live, so latency matters most here; and it's the path that dominates total spend at volume, which is what makes Step 8's token optimization worth doing.
- **Stage 2 (complex/sensitive escalation — used for the GitHub/Slack action step, Step 10): Claude Sonnet 5.** Only messages flagged critical/security/low-confidence reach this stage — synthesizing multiple tool results into a judgment call and drafting human-facing output is exactly where stronger reasoning earns its higher cost, on a minority of traffic.

---

## (d) Step 5 & 6: Core triager + parallel tool use

Implementation: `src/tools/definitions.ts` (4 custom tools + Step 9's web_search), `src/tools/executors.ts`, `src/triager/engine.ts`.

All four custom tools (`lookup_customer`, `fetch_recent_orders`, `fetch_recent_tickets`, `create_ticket`) key off `customer_email` directly rather than a chained `customer_id`, specifically so the first three have no dependency on each other's output — which is what makes them safe for Claude to call together in one turn. `engine.ts`'s loop executes every `tool_use` block from a turn concurrently (`Promise.all`) and returns **all** results in a single `tool_result` user message, per the API's rule that splitting them across messages trains the model to stop batching.

**Verified without live API calls**, via a scripted fake `Anthropic` client (`tests/engine.test.ts`) that returns pre-scripted multi-tool-use responses and asserts: both parallel tool calls land in one user message with the right `tool_use_id`s, a failed tool call is returned as `is_error: true` rather than dropped, and the final JSON parses against the schema. (Building this test caught a real bug in my *test* code — snapshotting a mutable shared array by reference instead of at call-time — not in `engine.ts`; worth noting since it's exactly the kind of mistake that looks like an engine bug until you check which side actually owns the mutation.)

---

## (e) Step 7: Streaming

Implementation: `src/triager/engineStream.ts`, using the documented `client.messages.stream()` + `finalMessage()` manual-loop pattern (not reimplementing event aggregation by hand).

**Verified without live API calls** (`tests/engineStream.test.ts`): a fake `MessageStream` fires scripted text deltas through `.on("text", ...)` before resolving `finalMessage()`; the test asserts the deltas received via the streaming callback, concatenated, equal exactly the text the final parsed JSON result came from — i.e. parsing genuinely works against the incremental event path, not just the finished payload.

---

## (e) Step 9: Built-in server tool

Full writeup: [`docs/server-tool.md`](docs/server-tool.md).

Enabled **web search** (`web_search_20260209`), scoped by the system prompt to exactly two topics: `security` (check whether a reported attack matches a known phishing pattern, for the security team's context) and `how_to` (find the specific doc page to link, instead of the agent searching manually). Server tools resolve fully on Anthropic's infrastructure — no `tool_use` pause, so enabling it required zero changes to the tool-execution loop. Memory and Bash were considered and rejected (no stateful cross-session need in a 20-message batch eval; no filesystem/shell task in this workflow) — web search was the only one mapping onto a concrete, explainable improvement in what ends up on the ticket.

---

## (f) Step 10: GitHub + Slack MCP connections

Full setup notes: [`docs/mcp-setup.md`](docs/mcp-setup.md), implementation: `src/mcp/servers.ts` + `src/mcp/act.ts`.

Both connected via the Messages API's **native remote-MCP connector** (`mcp_servers` + `mcp_toolset` tools, beta `mcp-client-2025-11-20`) — both GitHub (`api.githubcopilot.com/mcp/`) and Slack (`mcp.slack.com/mcp`) publish official hosted endpoints, so this is server-resolved the same way as Step 9's web search, not a locally-run process. GitHub auth reuses the already-authenticated `gh` CLI token; Slack needs a one-time Slack App + OAuth setup in the account holder's workspace (documented, in progress — see status below).

`src/mcp/act.ts`'s `fileAndNotify()` takes a completed triage result and: searches the target GitHub repo for an existing matching issue before filing a new one (avoiding duplicates), and posts one routing notification to the Slack channel mapped from the ticket's team. `npm run mcp:demo` runs this against eval message #18 (the critical production-integration outage) by default.

---

## (g) Step 11: Custom MCP server

Full writeup: [`docs/custom-mcp-server.md`](docs/custom-mcp-server.md), implementation: `src/mcp/kbServer.ts` (server), `src/mcp/kbData.ts` (mock KB), `src/mcp/bridge.ts` (generic MCP-client bridge).

**`search_kb`** — searches a small internal knowledge base for a known resolution before a ticket is created, specific to this support workflow (distinct from Step 9's public web search and the Step 5 data tools). **Transport: stdio** — chosen because this server has exactly one consumer (this project's own orchestrator, same machine, same lifecycle), which is the case stdio fits and HTTP's auth/network surface would be solving a problem that doesn't exist here; the inverse of Step 10, where GitHub/Slack's genuinely multi-tenant hosted servers justify HTTP + OAuth.

**Discovery and calling confirmed two ways:** a real subprocess-level test (`tests/kbServer.test.ts`, passes today, no API credits needed) spawns the actual server, calls `listTools()`, and calls `search_kb` with both a matching and a non-matching query; a live demo (`npm run kb:demo`, pending credits) has Claude itself decide to call it during a real `messages.create` turn.

---

## (h) Step 12: Full evaluation run

Runner ready: `src/cli/runEval.ts` (`npm run triage:eval`) — loops all 20 eval-set messages through `runTriage`, scores urgency/topic/team against `docs/eval-set.json`'s ground truth, and writes `docs/accuracy-report.json` with per-field accuracy, exact-match rate, a breakdown of which specific mismatches occurred per field, and total token usage.

**Status: pending API credits** — code-complete and typechecked, not yet run for real. Results (accuracy numbers, which categories are wrongest, commentary) will be added here once it runs.

---

## Live execution status

This account hit two real external blockers during the assignment, both documented as they happened rather than smoothed over:

1. **No free API tier.** The advertised no-card $5 trial credit wasn't actually granted to this account; "Evaluation access" turned out to mean console access only, confirmed by a real `credit balance too low` error after fixing an unrelated workspace-header auth issue first.
2. **Slack MCP setup** needs the account holder to create a Slack App and toggle on MCP support in their own workspace (documented in `docs/mcp-setup.md`) — independent of the credits blocker.

**What's proven without live credits:** every piece of *this project's own code* — the tool-use loop's parallel-call assembly and error handling, the streaming event-to-result consistency, the real custom MCP server's discoverability and correctness — via tests that exercise the actual code paths (mocked only at the Anthropic-API boundary, or, for the custom MCP server, not mocked at all). What's *not* yet proven is Claude's own behavior against this schema and these tools, which is exactly what Step 12's accuracy numbers are for — that requires the real API.

_This section will be updated with real numbers and screenshots once credits are available._
