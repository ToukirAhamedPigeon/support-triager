import type Anthropic from "@anthropic-ai/sdk";
import { TOOLS } from "../tools/definitions.js";
import { executeTool } from "../tools/executors.js";
import { SYSTEM_PROMPT, TriageResultSchema, extractJson, fallbackResult } from "./schema.js";
import type { TriageInput, TriageOutcome, TriageRunMeta } from "./types.js";

const MAX_TURNS = 6;

/**
 * Streaming variant of the triage loop (Step 7). Uses client.messages.stream()
 * + finalMessage() per turn — per Anthropic's documented streaming-manual-loop
 * pattern — so text deltas are available for a live UI (onTextDelta) while
 * finalMessage() still gives a fully-typed Message for tool-use/parsing, the
 * same way runTriage's non-streaming loop consumes messages.create()'s result.
 */
export async function runTriageStream(
  client: Anthropic,
  input: TriageInput,
  opts: { model: string },
  onTextDelta?: (delta: string) => void,
): Promise<TriageOutcome> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Customer email: ${input.customerEmail}\n\nMessage:\n${input.message}`,
    },
  ];

  const meta: TriageRunMeta = { toolCalls: [], inputTokens: 0, outputTokens: 0, turns: 0 };
  let streamedText = "";

  while (meta.turns < MAX_TURNS) {
    const stream = client.messages.stream({
      model: opts.model,
      max_tokens: 700,
      cache_control: { type: "ephemeral" },
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    stream.on("text", (delta) => {
      streamedText += delta;
      onTextDelta?.(delta);
    });

    const message = await stream.finalMessage();
    meta.turns++;
    meta.inputTokens += message.usage.input_tokens;
    meta.outputTokens += message.usage.output_tokens;

    if (message.stop_reason !== "tool_use") {
      // Parse from the incrementally-streamed text, not just the final
      // payload — this is what Step 7 asks to be confirmed: the same result
      // must come out whether read via events or via the finished message.
      const finalText = message.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? streamedText;
      try {
        const parsed = JSON.parse(extractJson(finalText));
        const result = TriageResultSchema.parse(parsed);
        return { result, meta };
      } catch {
        return { result: fallbackResult(finalText), meta };
      }
    }

    messages.push({ role: "assistant", content: message.content });
    streamedText = "";

    const toolUseBlocks = message.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    const resultBlocks: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const blockInput = block.input as Record<string, unknown>;
        let content: string;
        let isError = false;
        try {
          const result = executeTool(block.name, blockInput);
          meta.toolCalls.push({ name: block.name, input: blockInput, result });
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
  }

  throw new Error(`Triage did not reach end_turn within ${MAX_TURNS} turns`);
}
