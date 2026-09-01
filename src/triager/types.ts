export type Urgency = "critical" | "high" | "normal" | "low";
export type Topic =
  | "billing"
  | "bug"
  | "account_access"
  | "how_to"
  | "feature_request"
  | "outage"
  | "security"
  | "integration"
  | "sales"
  | "other";
export type Team = "billing_support" | "engineering" | "customer_success" | "security_team" | "sales_team";

export interface TriageResult {
  urgency: Urgency;
  topic: Topic;
  team: Team;
  confidence: number;
  needs_human_review: boolean;
  summary: string;
}

export interface TriageInput {
  customerEmail: string;
  message: string;
}

export interface TriageRunMeta {
  toolCalls: { name: string; input: Record<string, unknown>; result: unknown }[];
  inputTokens: number;
  outputTokens: number;
  turns: number;
}

export interface TriageOutcome {
  result: TriageResult;
  meta: TriageRunMeta;
}
