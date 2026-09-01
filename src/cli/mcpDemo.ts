import { makeClient, HAIKU } from "../lib/client.js";
import { runTriage } from "../triager/engine.js";
import { fileAndNotify } from "../mcp/act.js";
import { loadEvalSet } from "../lib/evalSet.js";

/** Step 10 demo: triage one message, then drive the GitHub + Slack MCP
 * connections to file/find an issue and post a routing notification. */
const evalSet = loadEvalSet();
const idArg = Number(process.argv[2] ?? 18); // default: the critical integration-outage message
const item = evalSet.find((m) => m.id === idArg);
if (!item) {
  console.error(`No eval-set message with id ${idArg}`);
  process.exit(1);
}

const client = makeClient();
console.log(`--- Triaging message #${item.id} ---\n${item.message}\n`);

const triage = await runTriage(client, { customerEmail: item.customer_email, message: item.message }, { model: HAIKU });
console.log("Triage result:", JSON.stringify(triage.result, null, 2));

console.log("\n--- Filing/notifying via GitHub + Slack MCP ---");
const outcome = await fileAndNotify(client, { customerEmail: item.customer_email, message: item.message }, triage.result);

for (const block of outcome.content) {
  if (block.type === "text") console.log("\n[Claude]", block.text);
  else console.log(`\n[${block.type}]`, JSON.stringify(block, null, 2).slice(0, 500));
}
console.log("\nStop reason:", outcome.stopReason);
