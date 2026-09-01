import type Anthropic from "@anthropic-ai/sdk";
import { TOOLS } from "../tools/definitions.js";
import { executeTool } from "../tools/executors.js";
import { SYSTEM_PROMPT, TriageResultSchema } from "./schema.js";
import type { TriageInput, TriageOutcome, TriageRunMeta } from "./types.js";

const MAX_TURNS = 6;

/**
 * Core triage loop (Steps 5 & 6). Any turn where Claude emits more than one
 * tool_use block executes them concurrently with Promise.all and returns all
 * tool_result blocks in a single user message — per the Anthropic API's rule
 * that splitting them across messages trains the model to stop batching.
 */
export async function runTriage(
  client: Anthropic,
  input: TriageInput,
  opts: { model: string },
): Promise<TriageOutcome> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Customer email: ${input.customerEmail}\n\nMessage:\n${input.message}`,
    },
  ];

  const meta: TriageRunMeta = { toolCalls: [], inputTokens: 0, outputTokens: 0, turns: 0 };
  let response = await client.messages.create({
    model: opts.model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages,
  });
  meta.turns++;
  meta.inputTokens += response.usage.input_tokens;
  meta.outputTokens += response.usage.output_tokens;

  while (response.stop_reason === "tool_use" && meta.turns < MAX_TURNS) {
    messages.push({ role: "assistant", content: response.content });

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    // Parallel execution — every tool takes only `email` (or a self-contained
    // create_ticket payload), so none of these calls depend on another's result.
    const resultBlocks: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const input = block.input as Record<string, unknown>;
        let content: string;
        let isError = false;
        try {
          const result = executeTool(block.name, input);
          meta.toolCalls.push({ name: block.name, input, result });
          content = JSON.stringify(result);
        } catch (err) {
          isError = true;
          content = err instanceof Error ? err.message : String(err);
        }
        return {
          type: "tool_result",
          tool_use_id: block.id,
          content,
          ...(isError ? { is_error: true } : {}),
        };
      }),
    );

    messages.push({ role: "user", content: resultBlocks });

    response = await client.messages.create({
      model: opts.model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });
    meta.turns++;
    meta.inputTokens += response.usage.input_tokens;
    meta.outputTokens += response.usage.output_tokens;
  }

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) {
    throw new Error(`No text block in final response (stop_reason: ${response.stop_reason})`);
  }

  const parsed = JSON.parse(textBlock.text.trim());
  const result = TriageResultSchema.parse(parsed);

  return { result, meta };
}
