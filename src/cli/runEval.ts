import { writeFileSync } from "node:fs";
import { makeClient, HAIKU } from "../lib/client.js";
import { runTriage } from "../triager/engine.js";
import { loadEvalSet } from "../lib/evalSet.js";

/** Step 12: run the full 20-message eval set through the pipeline and report
 * accuracy against ground truth, plus which fields are most often wrong. */
const evalSet = loadEvalSet();
const client = makeClient();

interface Row {
  id: number;
  predicted: { urgency: string; topic: string; team: string };
  actual: { urgency: string; topic: string; team: string };
  urgencyCorrect: boolean;
  topicCorrect: boolean;
  teamCorrect: boolean;
  inputTokens: number;
  outputTokens: number;
  turns: number;
  error?: string;
}

const rows: Row[] = [];

for (const item of evalSet) {
  process.stdout.write(`Triaging #${item.id}... `);
  try {
    const outcome = await runTriage(client, { customerEmail: item.customer_email, message: item.message }, { model: HAIKU });
    const predicted = { urgency: outcome.result.urgency, topic: outcome.result.topic, team: outcome.result.team };
    const row: Row = {
      id: item.id,
      predicted,
      actual: item.label,
      urgencyCorrect: predicted.urgency === item.label.urgency,
      topicCorrect: predicted.topic === item.label.topic,
      teamCorrect: predicted.team === item.label.team,
      inputTokens: outcome.meta.inputTokens,
      outputTokens: outcome.meta.outputTokens,
      turns: outcome.meta.turns,
    };
    rows.push(row);
    console.log(row.urgencyCorrect && row.topicCorrect && row.teamCorrect ? "OK" : "MISMATCH");
  } catch (err) {
    console.log("ERROR");
    rows.push({
      id: item.id,
      predicted: { urgency: "", topic: "", team: "" },
      actual: item.label,
      urgencyCorrect: false,
      topicCorrect: false,
      teamCorrect: false,
      inputTokens: 0,
      outputTokens: 0,
      turns: 0,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

const n = rows.length;
const urgencyAcc = rows.filter((r) => r.urgencyCorrect).length / n;
const topicAcc = rows.filter((r) => r.topicCorrect).length / n;
const teamAcc = rows.filter((r) => r.teamCorrect).length / n;
const exactAcc = rows.filter((r) => r.urgencyCorrect && r.topicCorrect && r.teamCorrect).length / n;
const totalInputTokens = rows.reduce((s, r) => s + r.inputTokens, 0);
const totalOutputTokens = rows.reduce((s, r) => s + r.outputTokens, 0);

const topicMistakes = rows.filter((r) => !r.topicCorrect).map((r) => ({ id: r.id, predicted: r.predicted.topic, actual: r.actual.topic }));
const teamMistakes = rows.filter((r) => !r.teamCorrect).map((r) => ({ id: r.id, predicted: r.predicted.team, actual: r.actual.team }));
const urgencyMistakes = rows.filter((r) => !r.urgencyCorrect).map((r) => ({ id: r.id, predicted: r.predicted.urgency, actual: r.actual.urgency }));

const report = {
  n,
  accuracy: { urgency: urgencyAcc, topic: topicAcc, team: teamAcc, exactMatchAllThree: exactAcc },
  mistakes: { urgency: urgencyMistakes, topic: topicMistakes, team: teamMistakes },
  tokens: { totalInputTokens, totalOutputTokens, totalTokens: totalInputTokens + totalOutputTokens },
  rows,
};

writeFileSync(new URL("../../docs/accuracy-report.json", import.meta.url), JSON.stringify(report, null, 2));

console.log("\n=== Accuracy ===");
console.log(`Urgency: ${(urgencyAcc * 100).toFixed(0)}%  Topic: ${(topicAcc * 100).toFixed(0)}%  Team: ${(teamAcc * 100).toFixed(0)}%  All-3-exact: ${(exactAcc * 100).toFixed(0)}%`);
console.log(`Total tokens: ${totalInputTokens} in / ${totalOutputTokens} out`);
console.log("Wrote docs/accuracy-report.json");
