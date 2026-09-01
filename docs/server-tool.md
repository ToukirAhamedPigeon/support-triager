# Built-in Server Tool (Step 9)

**Enabled: Web Search** (`web_search_20260209`), added to `TOOLS` in `src/tools/definitions.ts`.

## Why web search, and why this narrowly

It's declared once and available on every call, but the system prompt (`src/triager/schema.ts`) restricts when it should actually be used, to exactly two topics:

- **security** — check whether the described attack (a suspicious link, an unusual request) matches a known, publicly-documented phishing/scam pattern, so the ticket handed to the security team already carries that context instead of them starting from zero.
- **how_to** — find the specific public documentation page that answers the question, so it can be linked directly in the ticket rather than the agent having to go search for it themselves.

Both are cases where an LLM's training data is a poor substitute for a live lookup (phishing campaigns and doc URLs both change after any model's training cutoff), and where the result meaningfully changes what ends up in the ticket a human reads — not just decoration.

It's explicitly capped at `max_uses: 1` and the prompt tells the model not to use it for the other eight topics (billing, bug, account_access, outage, integration, feature_request, sales, other) — none of those benefit from a live web lookup, so leaving it unrestricted would just add latency and token cost with no accuracy or usefulness gain.

## Integration cost: none

Server tools resolve entirely on Anthropic's infrastructure — the call and its result both arrive as content blocks (`server_tool_use` / `web_search_tool_result`) within the same turn, not as a `tool_use` stop the client has to answer. Because `engine.ts`'s loop only reacts to blocks of type `tool_use` (the four custom tools), adding web search required zero changes to the tool-execution loop in `engine.ts` or `engineStream.ts` — only the tool declaration and the system-prompt guidance above.

## What else was considered

- **Code execution** — no genuine use here; the triager doesn't do numeric/data work that benefits from a sandboxed interpreter.
- **Memory** (`memory_20250818`) — would let the triager persist facts across runs (e.g. "this customer has filed 3 billing complaints this quarter"), which is a real idea for a production triager, but it's a stateful, cross-session feature that doesn't fit a stateless 20-message batch eval, and the existing `fetch_recent_tickets` tool already surfaces that history for this project's scope.
- **Bash** — no filesystem/shell task exists in this workflow; would be pure unused surface area.

Web search was the only one of the four that maps onto a concrete, explainable improvement in what a human agent receives on the resulting ticket.
