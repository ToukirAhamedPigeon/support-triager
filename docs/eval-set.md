# Evaluation Set (Step 2)

20 hand-written, hand-labeled support messages, spanning all 10 topics and all 5 teams in the [schema](schema.md), with a realistic urgency spread (3 critical / 6 high / 8 normal / 3 low). Full data: [`eval-set.json`](eval-set.json).

## Labeling methodology

Each message was labeled by hand against the schema's definitions before any triager code was written, so scoring in Step 12 is against a genuine pre-committed ground truth, not a target chosen after seeing model output.

## Deliberately hard cases (for later error analysis)

- **#19** ("I upgraded... but still seeing free-tier limits") — plausibly `billing` (the upgrade/payment didn't take effect) or `account_access` (the account's permissions/entitlements are wrong). Labeled `billing` because the root cause is almost always a payment/plan-sync issue, but a reasonable triager could land on `account_access` — worth watching in the confusion matrix.
- **#20** ("It's not working. Please help.") — essentially no signal. Labeled `other` / `normal` / `customer_success` as the safe default, but the real test here is whether the triager's `confidence` comes back low and `needs_human_review: true`, per the schema's uncertainty rule — not whether it guesses the "right" topic, since there isn't enough information to know one.

## Coverage

| | Count |
|---|---|
| Topics | all 10 represented (billing ×3, feature_request ×2, outage ×2, bug ×2, how_to ×2, account_access ×2, security ×2, integration ×2, sales ×1, other ×2) |
| Teams | billing_support ×3, engineering ×8, customer_success ×6, security_team ×2, sales_team ×1 |
| Urgency | critical ×3, high ×6, normal ×8, low ×3 |
