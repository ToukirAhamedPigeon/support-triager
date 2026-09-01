import { makeClient, HAIKU } from "../lib/client.js";
import { runTriageStream } from "../triager/engineStream.js";
import { loadEvalSet } from "../lib/evalSet.js";

/** Step 7 demo: stream a triage run so text prints as it's generated, then
 * confirm the parsed structured result matches the streamed text. */
const evalSet = loadEvalSet();
const idArg = Number(process.argv[2] ?? 3);
const item = evalSet.find((m) => m.id === idArg);
if (!item) {
  console.error(`No eval-set message with id ${idArg}`);
  process.exit(1);
}

const client = makeClient();
console.log(`--- Streaming triage for message #${item.id} (${item.customer_email}) ---\n${item.message}\n`);
console.log("Live output:");

const outcome = await runTriageStream(
  client,
  { customerEmail: item.customer_email, message: item.message },
  { model: HAIKU },
  (delta) => process.stdout.write(delta),
);

console.log("\n\nParsed result:", JSON.stringify(outcome.result, null, 2));
console.log(`Turns: ${outcome.meta.turns}  Tool calls: ${outcome.meta.toolCalls.map((c) => c.name).join(", ")}`);
