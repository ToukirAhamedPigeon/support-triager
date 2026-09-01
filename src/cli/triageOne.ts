import { makeClient, HAIKU } from "../lib/client.js";
import { runTriage } from "../triager/engine.js";
import { loadEvalSet } from "../lib/evalSet.js";

/** Step 5/6 demo: run one eval-set message through the core engine and print
 * exactly which tools were called (and whether any ran in parallel). */
const evalSet = loadEvalSet();
const idArg = Number(process.argv[2] ?? 1);
const item = evalSet.find((m) => m.id === idArg);
if (!item) {
  console.error(`No eval-set message with id ${idArg}`);
  process.exit(1);
}

const client = makeClient();
console.log(`--- Message #${item.id} (${item.customer_email}) ---\n${item.message}\n`);

const outcome = await runTriage(client, { customerEmail: item.customer_email, message: item.message }, { model: HAIKU });

console.log("Tool calls made:");
for (const call of outcome.meta.toolCalls) {
  console.log(`  - ${call.name}(${JSON.stringify(call.input)})`);
}
console.log(`\nTurns: ${outcome.meta.turns}  Input tokens: ${outcome.meta.inputTokens}  Output tokens: ${outcome.meta.outputTokens}`);
console.log("\nResult:", JSON.stringify(outcome.result, null, 2));
console.log("\nGround truth:", JSON.stringify(item.label, null, 2));
