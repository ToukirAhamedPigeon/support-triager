import { z } from "zod";
import type { TriageResult } from "./types.js";

/** Models don't always emit pure JSON despite instructions — sometimes
 * wrapped in markdown fences, sometimes with prose before/after (observed
 * live on low-signal messages, e.g. eval #10/#20, where the model explains
 * its uncertainty before answering). Defensive extraction beats relying on
 * prompt compliance alone. */
export function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) return fenced[1];

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}

/** Observed live: on very low-signal messages the model sometimes asks a
 * clarifying question in prose instead of forcing a JSON answer (a
 * reasonable instinct that breaks the format contract). Rather than crash,
 * the engine falls back to this — itself a correct application of the
 * schema's own "unsure" rule: low confidence, needs_human_review true,
 * urgency normal — while preserving what Claude actually said as the
 * summary, so a human still gets useful context. */
export function fallbackResult(rawText: string): TriageResult {
  return {
    urgency: "normal",
    topic: "other",
    team: "customer_success",
    confidence: 0,
    needs_human_review: true,
    summary: `Triager could not produce a structured decision; raw model output: ${rawText.slice(0, 300)}`,
  };
}

export const TriageResultSchema = z.object({
  urgency: z.enum(["critical", "high", "normal", "low"]),
  topic: z.enum([
    "billing",
    "bug",
    "account_access",
    "how_to",
    "feature_request",
    "outage",
    "security",
    "integration",
    "sales",
    "other",
  ]),
  team: z.enum(["billing_support", "engineering", "customer_success", "security_team", "sales_team"]),
  confidence: z.number().min(0).max(1),
  needs_human_review: z.boolean(),
  summary: z.string().min(1),
});

export const SYSTEM_PROMPT = `You are a support-ticket triager, given a customer's email and message, plus tools for account/order/ticket lookup and ticket creation.

Call lookup_customer, fetch_recent_orders, and fetch_recent_tickets together in one turn when you need more than one — they don't depend on each other's output. Call create_ticket once you have enough context.

web_search is available but use it at most once, only for "security" topics (check if the described attack matches a known public phishing pattern) or "how_to" topics (find the exact doc page) — never for the other eight topics.

After create_ticket, respond with ONLY this JSON (no prose, no markdown fences):
{
  "urgency": "critical" | "high" | "normal" | "low",
  "topic": "billing" | "bug" | "account_access" | "how_to" | "feature_request" | "outage" | "security" | "integration" | "sales" | "other",
  "team": "billing_support" | "engineering" | "customer_success" | "security_team" | "sales_team",
  "confidence": <0.0-1.0, your genuine confidence in topic/team>,
  "needs_human_review": <true if confidence < 0.7, OR urgency is "critical", OR topic is "security" — else false>,
  "summary": "<one sentence restating the issue>"
}

Severity — be conservative, not dramatic:
- critical: ONLY a currently active outage/data loss/security breach/complete inability to use a paid product, zero workaround, happening right now.
- high: broken functionality with no workaround, OR a real billing error, OR an unconfirmed security concern. A tight deadline or urgent tone does NOT by itself make something high or critical — e.g. a delayed password-reset email is high only because there's genuinely no workaround, not because a meeting is soon.
- normal: default here whenever a workaround exists or impact is limited — most requests belong here even when the customer sounds urgent.
- low: feature requests, praise, general feedback.

Unsure: never leave a field blank or use a value outside the enums. Pick the most likely topic/team, set confidence honestly low, needs_human_review true, urgency "normal" — guessing critical/high without clear evidence is the single most common mistake to avoid.`;
