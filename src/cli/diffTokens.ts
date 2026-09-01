import { readFileSync } from "node:fs";
import { HAIKU } from "../lib/client.js";

/** Step 8: compare two saved runEval.ts reports (before/after optimization)
 * and print token + estimated-cost deltas, plus any accuracy change. */
const HAIKU_INPUT_PER_MTOK = 1.0;
const HAIKU_OUTPUT_PER_MTOK = 5.0;

const [, , beforePath, afterPath] = process.argv;
if (!beforePath || !afterPath) {
  console.error("Usage: diffTokens.ts <before.json> <after.json>");
  process.exit(1);
}

const before = JSON.parse(readFileSync(beforePath, "utf8"));
const after = JSON.parse(readFileSync(afterPath, "utf8"));

function cost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * HAIKU_INPUT_PER_MTOK + (outputTokens / 1_000_000) * HAIKU_OUTPUT_PER_MTOK;
}

const beforeCost = cost(before.tokens.totalInputTokens, before.tokens.totalOutputTokens);
const afterCost = cost(after.tokens.totalInputTokens, after.tokens.totalOutputTokens);

console.log(`Model: ${HAIKU}`);
console.log("\n=== Tokens ===");
console.log(`Before: ${before.tokens.totalInputTokens} in / ${before.tokens.totalOutputTokens} out / ${before.tokens.totalTokens} total`);
console.log(`After:  ${after.tokens.totalInputTokens} in / ${after.tokens.totalOutputTokens} out / ${after.tokens.totalTokens} total`);
const pctSaved = ((before.tokens.totalTokens - after.tokens.totalTokens) / before.tokens.totalTokens) * 100;
console.log(`Change: ${pctSaved.toFixed(1)}% ${pctSaved >= 0 ? "reduction" : "increase"}`);

console.log("\n=== Estimated cost (full 20-message pass) ===");
console.log(`Before: $${beforeCost.toFixed(5)}`);
console.log(`After:  $${afterCost.toFixed(5)}`);

console.log("\n=== Accuracy ===");
console.log(`Before: urgency ${(before.accuracy.urgency * 100).toFixed(0)}% topic ${(before.accuracy.topic * 100).toFixed(0)}% team ${(before.accuracy.team * 100).toFixed(0)}% exact ${(before.accuracy.exactMatchAllThree * 100).toFixed(0)}%`);
console.log(`After:  urgency ${(after.accuracy.urgency * 100).toFixed(0)}% topic ${(after.accuracy.topic * 100).toFixed(0)}% team ${(after.accuracy.team * 100).toFixed(0)}% exact ${(after.accuracy.exactMatchAllThree * 100).toFixed(0)}%`);
