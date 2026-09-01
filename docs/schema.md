# Triage Output Schema (Step 3)

Every triage call must return exactly this JSON shape — no extra top-level fields, no omitted fields.

```json
{
  "urgency": "critical | high | normal | low",
  "topic": "billing | bug | account_access | how_to | feature_request | outage | security | integration | sales | other",
  "team": "billing_support | engineering | customer_success | security_team | sales_team",
  "confidence": 0.0,
  "needs_human_review": false,
  "summary": "one sentence restating the customer's issue in the triager's own words"
}
```

## Field definitions

- **urgency** — how fast this needs a response, not how upset the customer sounds.
  - `critical`: active outage, data loss, security breach, or complete inability to use a paid product with no workaround, affecting the customer *right now*.
  - `high`: broken functionality with no workaround, billing error costing the customer money, or a security concern that isn't confirmed-active.
  - `normal`: real issue, workaround exists or impact is limited (single feature, non-blocking bug, standard how-to question).
  - `low`: feature requests, praise, general feedback, no functional impact.
- **topic** — closed enum, 10 values (see schema above). No free text.
- **team** — closed enum, 5 values. Must be consistent with topic (see mapping below) unless the message content overrides the default (e.g. a "bug" that's actually a suspected account compromise routes to `security_team`, not `engineering`).
- **confidence** — the triager's own estimate, 0.0–1.0, of how confident it is in the `topic` + `team` assignment. Not a vibe — it should reflect genuine ambiguity in the message (multiple plausible topics, missing context, mixed signals).
- **needs_human_review** — `true` whenever `confidence < 0.7`, OR whenever `urgency` is `critical`, OR whenever `topic` is `security` (critical/security findings always get a human set of eyes regardless of confidence). Otherwise `false`.
- **summary** — always populated, even when uncertain — never blank, never "unclear."

## Default topic → team mapping

| Topic | Default team |
|---|---|
| billing | billing_support |
| bug | engineering |
| account_access | customer_success |
| how_to | customer_success |
| feature_request | engineering |
| outage | engineering |
| security | security_team |
| integration | engineering |
| sales | sales_team |
| other | customer_success |

## When the model is unsure

The triager must never leave a field blank, invent a 10th topic, or refuse to answer. Instead:
- Pick the **single most likely** value for `topic`/`team` from the closed enums.
- Set `confidence` honestly low (e.g. 0.3–0.5) rather than defaulting to a fixed number.
- Set `needs_human_review: true`.
- Default `urgency` to `normal` when signals are mixed — never guess `critical` under uncertainty, since a false-critical is worse than a missed one that a human catches on review (it pages someone for nothing and erodes trust in the triager, exactly the same principle as the PR-review bot's must-fix rubric rule).
