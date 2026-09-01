# Model Tier Selection (Step 4)

Two tiers, chosen by what each stage actually needs — not by brand preference.

## Stage 1 — high-volume classification: Claude Haiku 4.5

Every incoming message goes through this stage: schema classification (Step 3) plus the initial tool calls (customer lookup, order lookup, ticket creation).

- **Capability:** the task is bounded — a closed 10-value topic enum, a closed 5-value team enum, a 4-value urgency enum, plus well-specified tool signatures. This is exactly the shape of task a smaller model handles reliably; the ceiling on accuracy here is the schema and prompt, not raw reasoning depth. Extra reasoning power is wasted when the model isn't being asked to reason freely, just to classify against a fixed contract and pick the right tool.
- **Latency:** this is the path every message takes, so its latency multiplies by volume. It's also the path a human agent is watching stream in real time (Step 7) — a fast p50 here directly determines how responsive the live queue feels. Haiku's lower per-request latency matters most exactly where it's spent most often.
- **Cost:** at production volume, this is the stage that dominates total spend, since it runs on 100% of traffic. Haiku's lower per-token price is what makes the token-optimization work in Step 8 meaningful — optimizing a cheap-per-call, high-volume stage has more total-cost leverage than optimizing a stage that runs rarely.

## Stage 2 — complex/sensitive escalation: Claude Sonnet 5

Only messages that come out of Stage 1 flagged `urgency: critical`, `topic: security`, or `needs_human_review: true` (per the schema's uncertainty rule) go through this stage — synthesizing multiple tool results (customer history, order data, and, where enabled, web search per Step 9) into a judgment call, and drafting the actual escalation (e.g. the GitHub issue body or Slack message).

- **Capability:** this is exactly where raw reasoning matters — weighing ambiguous or conflicting signals across several tool results, deciding whether something is genuinely critical, and producing well-reasoned, human-readable output for a case a person is about to act on. This is the minority of traffic where a wrong call is expensive (a missed real outage, a mishandled security report), so the stronger model's judgment is worth paying for here specifically.
- **Latency:** these are inherently lower-volume, and a human is typically already in the loop for anything flagged this way (that's what `needs_human_review` means) — a few extra seconds of latency for better judgment on a critical/security case is an acceptable trade that would not be acceptable multiplied across every message in Stage 1.
- **Cost:** reserving the higher per-token tier for ~15-20% of traffic (only what's actually flagged) keeps the *average* cost per message close to Stage 1's, while still spending more where it's justified — routing 100% of traffic through the stronger tier would multiply cost with no corresponding accuracy gain on the bulk of messages, which are straightforward classification, not judgment calls.

## Note

This split is a hypothesis, not a claim — Step 12's accuracy report (scored against the Step 2 ground truth) is the actual test of whether Haiku alone is sufficient for Stage 1's classification accuracy, or whether some categories need to escalate more often than the rules above assume. See `docs/accuracy-report.md` for what the evaluation run actually showed.
