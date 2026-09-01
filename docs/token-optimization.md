# Token Optimization (Step 8)

## Method

1. Run `npm run triage:eval` against the clean baseline implementation → produces `docs/accuracy-report.json`; save a copy as `docs/token-baseline.json`.
2. Apply the three optimizations below directly to `src/triager/engine.ts` / `schema.ts` (not a parallel "optimized" copy — real before/after on the same code path).
3. Re-run `npm run triage:eval` → save as `docs/token-after.json`.
4. `npm run tokens:diff docs/token-baseline.json docs/token-after.json` for the before/after token, cost, and accuracy comparison.

_Numbers below are filled in once API credits are available to actually run the eval set — see `REPORT.md` for status. The plan itself, and why each lever was chosen, doesn't depend on having run it yet._

## Planned optimizations

1. **Prompt caching on the system prompt + tools** (`cache_control: {type: "ephemeral"}`). `SYSTEM_PROMPT` and `TOOLS` are byte-identical across all 20 messages and every turn within a message — this is exactly the "stable prefix, render order tools→system→messages" shape prompt caching is built for. Expected effect: the first call per run pays full price to write the cache; every call after (turns 2+ within a message, and messages 2-20 in the eval loop) reads that prefix at roughly 1/10th cost instead of full input-token price. This is a free win — no quality tradeoff.

2. **Trim tool-result payloads before returning them to the model.** `executeTool` currently returns full mock records (e.g. a customer's `accountCreated` date, an order's raw `orderId`) even though the triager only ever reasons about a handful of those fields (plan tier, recent ticket count/team, order status). Returning a smaller `tool_result` JSON object shrinks the input tokens of every subsequent turn in that message (tool results are resent as history on each follow-up call). Care point: don't cut a field the model's reasoning genuinely uses — validated by re-running the eval set's accuracy after trimming, not just its token count.

3. **Shorten `SYSTEM_PROMPT` and lower `max_tokens`.** The current system prompt (`src/triager/schema.ts`) restates the severity guide in full prose on every single call; several sentences can compress to the same instruction in fewer tokens without losing the decision rules that actually shape output (the unsure-handling rule, the must-fix-style severity discipline). Separately, `max_tokens` is set to a generic `1024` — the actual final answer is a ~150-token JSON object, so a tighter cap (with tool-use turns given their own smaller allowance) removes headroom that isn't being used but that a streaming/timeout budget still has to account for.

## What's deliberately *not* on this list

- **Model tier changes** — Stage 1 is already Haiku 4.5 (see `docs/model-selection.md`); downgrading further isn't available, and upgrading would move cost the wrong direction for a lever whose entire point is reducing spend.
- **Reducing tool calls** — cutting `fetch_recent_tickets` or `fetch_recent_orders` from every run would save tokens but is a quality tradeoff (less context for the model's judgment), not a free win, so it's out of scope for *token* optimization specifically. If accuracy results (Step 12) show a tool consistently doesn't change the outcome, that's a separate finding worth revisiting the tool surface for — not something to cut preemptively to hit a token number.

## Results

_Pending API credits — see `REPORT.md` "Live execution status."_
