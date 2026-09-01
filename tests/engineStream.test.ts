import { describe, it, expect, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { runTriageStream } from "../src/triager/engineStream";

function usage(input: number, output: number) {
  return { input_tokens: input, output_tokens: output, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeMessage(partial: any): Anthropic.Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5",
    stop_sequence: null,
    usage: usage(0, 0),
    content: [],
    stop_reason: "end_turn",
    ...partial,
  } as Anthropic.Message;
}

/** Minimal fake of the SDK's MessageStream: supports .on("text", cb) and
 * .finalMessage(), firing the scripted text deltas before resolving — the
 * same shape engineStream.ts actually consumes. */
function fakeMessageStream(finalMsg: Anthropic.Message, textDeltas: string[]) {
  const textListeners: ((delta: string) => void)[] = [];
  return {
    on(event: string, cb: (delta: string) => void) {
      if (event === "text") textListeners.push(cb);
      return this;
    },
    async finalMessage() {
      for (const delta of textDeltas) for (const cb of textListeners) cb(delta);
      return finalMsg;
    },
  };
}

function scriptedStreamingClient(turns: { message: Anthropic.Message; textDeltas?: string[] }[]) {
  const argsPerCall: any[] = [];
  let i = 0;
  const stream = vi.fn((args: any) => {
    argsPerCall.push(structuredClone(args));
    const turn = turns[i++];
    return fakeMessageStream(turn.message, turn.textDeltas ?? []);
  });
  return { client: { messages: { stream } } as unknown as Anthropic, argsPerCall };
}

describe("runTriageStream", () => {
  it("forwards streamed text deltas and still parses the same final JSON result", async () => {
    const finalJson = {
      urgency: "critical",
      topic: "outage",
      team: "engineering",
      confidence: 0.98,
      needs_human_review: true,
      summary: "Platform-wide outage blocking a client demo.",
    };
    const jsonText = JSON.stringify(finalJson);
    const chunks = [jsonText.slice(0, 10), jsonText.slice(10, 25), jsonText.slice(25)];

    const { client, argsPerCall } = scriptedStreamingClient([
      {
        message: fakeMessage({
          stop_reason: "tool_use",
          usage: usage(150, 20),
          content: [
            { type: "tool_use", id: "call_1", name: "lookup_customer", input: { email: "maria.chen@globex.io" } },
            { type: "tool_use", id: "call_2", name: "fetch_recent_orders", input: { email: "maria.chen@globex.io" } },
          ],
        }),
      },
      {
        message: fakeMessage({
          stop_reason: "end_turn",
          usage: usage(200, 50),
          content: [{ type: "text", text: jsonText, citations: [] }],
        }),
        textDeltas: chunks,
      },
    ]);

    const received: string[] = [];
    const outcome = await runTriageStream(
      client,
      { customerEmail: "maria.chen@globex.io", message: "Platform down, demo in an hour." },
      { model: "claude-haiku-4-5" },
      (delta) => received.push(delta),
    );

    // Streamed deltas reconstruct the exact same text the final parsed result came from
    expect(received.join("")).toBe(jsonText);
    expect(outcome.result).toEqual(finalJson);

    // Turn 1's two parallel tool_use blocks -> one user message with 2 tool_results
    const secondCallArgs = argsPerCall[1];
    const toolResultMessage = secondCallArgs.messages.at(-1);
    expect(toolResultMessage.content).toHaveLength(2);
    expect(outcome.meta.toolCalls.map((c) => c.name)).toEqual(["lookup_customer", "fetch_recent_orders"]);
    expect(outcome.meta.inputTokens).toBe(350);
    expect(outcome.meta.outputTokens).toBe(70);
  });
});
