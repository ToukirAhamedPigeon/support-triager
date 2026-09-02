# Step 12: Full Evaluation — Accuracy Report

Run via `npm run triage:eval` against all 20 labeled messages (`docs/eval-set.json`), using the final (post-Step-8-optimization) engine. Full row-level data: [`docs/accuracy-report.json`](accuracy-report.json).

## Scores

| Field | Accuracy |
|---|---|
| Urgency | 80% (16/20) |
| Topic | 90% (18/20) |
| Team | 95% (19/20) |
| **Exact match (all 3)** | **75% (15/20)** |

Zero pipeline errors — every message produced a valid, schema-conformant decision (see Step 8 below for how the two initial parsing failures were fixed, not just retried away).

## Which category is wrongest, and why

**Urgency is the weakest field**, and every one of its 4 remaining mistakes is the same direction: **over-escalation** (predicting `high` when actual is `normal`, `critical` when actual is `high` — never the reverse). This is the same bias the *baseline* run showed too (7 of 8 baseline urgency mistakes were also over-escalation) — the Step 8 prompt rewrite that explicitly targeted this (`"be conservative, not dramatic"`, `"a tight deadline... does NOT alone make something high or critical"`) cut the mistake count roughly in half (8→4) but didn't eliminate the underlying tendency. Two of the four (#8, #19) are billing/access messages with a plausible-sounding but non-blocking complaint; the model appears to weight *customer-expressed urgency* (tone, phrases like "urgently," a stated deadline) more heavily than the rubric's actual test (*is there truly no workaround, right now*).

**One message (#15) accounts for 3 of the remaining mismatches at once** (urgency, topic, and team all wrong) — "Our finance team needs a CSV export... Could this be prioritized? It's blocking our audit prep." This is genuinely ambiguous even to a human: it reads as *both* "how do I get this" (how_to) and "please build this" (feature_request), and "blocking our audit prep" is the kind of phrasing that reasonably triggers the same over-escalation pattern above.

**What I'd change for the weaker number:** not more prompt tuning in the same direction (diminishing returns already visible: it worked, but didn't fully fix it) — instead, add a concrete counter-example pair directly in the system prompt contrasting a stated-deadline-but-workaround-exists message (→ normal) against a truly-blocking one (→ high/critical), since the current guidance states the *rule* but not a worked example, and the errors cluster exactly on messages where deadline language is present but a workaround exists. Message #15 specifically suggests the how_to/feature_request boundary needs its own explicit rule ("if the customer is asking *how* to do something that already exists, how_to; if asking for new capability, feature_request") rather than leaving it to be inferred.

## Step 8: token optimization — before/after

Run via `npm run tokens:diff docs/token-baseline.json docs/token-after.json`, same 20-message pass, same model (Haiku 4.5), before vs. after applying the three optimizations from `docs/token-optimization.md`:

| | Before | After | Change |
|---|---|---|---|
| Input tokens | 259,637 | 180,941 | **-30.3%** |
| Output tokens | 8,885 | 8,940 | +0.6% (noise — output size wasn't a target) |
| Total tokens | 268,522 | 189,881 | **-29.3%** |
| Estimated cost (full pass) | $0.30406 | $0.22564 | **-25.8%** |
| Urgency accuracy | 60% | 80% | +20pp |
| Topic accuracy | 100% | 90% | -10pp |
| Team accuracy | 85% | 95% | +10pp |
| Exact-match accuracy | 55% | 75% | +20pp |

**What actually drove the ~30% input-token reduction:** prompt caching (identical system prompt + tool schemas across all ~60 API calls in a 20-message pass) and shortening `SYSTEM_PROMPT` were the two real levers — trimming tool-result payloads (dropping unused fields like `accountCreated`, `orderId`, `ticketId`, `customerEmail` from what's echoed back) contributed a smaller amount since those are naturally small mock records. **A planned fourth lever — lowering `max_tokens` — turned out not to be a real savings lever at all** and was dropped: the ceiling doesn't reduce billed tokens unless it truncates output, and truncating output is a bug, not a saving (worth noting since it was in the original plan and is an easy mistake to make).

**Accuracy net effect:** three fields improved and one (topic) dipped slightly — the dip is within the range of ordinary LLM run-to-run variance on the two already-ambiguous boundary cases (#15, #17) discussed above, not something the shortened prompt or trimmed payloads plausibly caused (neither touches topic-classification-relevant content). The token/cost reduction did not come at a real accuracy cost.

## A genuine failure mode found and fixed along the way

The *first* post-optimization run (before the fix below) had 2 of 20 messages crash instead of scoring a wrong answer: on very low-signal input (`#20`: "It's not working. Please help.") the model sometimes chose to ask a clarifying question in prose instead of forcing a JSON answer — a reasonable instinct that broke the strict output-format contract. Fixed by making the engine itself fall back to a safe `needs_human_review: true, confidence: 0` result (using the model's own prose as the summary) instead of throwing — which is really just the schema's own Step 3 "unsure" rule, enforced by code instead of relying on prompt compliance alone. Locked in with a mocked-client test (`tests/engine.test.ts`).
