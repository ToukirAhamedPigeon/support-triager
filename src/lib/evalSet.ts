import { readFileSync } from "node:fs";

export interface EvalItem {
  id: number;
  customer_email: string;
  message: string;
  label: { urgency: string; topic: string; team: string };
}

export function loadEvalSet(): EvalItem[] {
  return JSON.parse(readFileSync(new URL("../../docs/eval-set.json", import.meta.url), "utf8"));
}
