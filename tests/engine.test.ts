import { describe, it, expect, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { runTriage } from "../src/triager/engine";

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

/**
 * `messages` is mutated in place by engine.ts across turns (correct — it's
 * the standard stateless-history pattern), so a mock that just records args
 * by reference would see every call's `messages` as the FINAL post-run state.
 * This snapshots (deep-clones) the args synchronously at call time instead.
 */
function scriptedClient(responses: Anthropic.Message[]) {
  const argsPerCall: any[] = [];
  let i = 0;
  const create = vi.fn(async (args: any) => {
    argsPerCall.push(structuredClone(args));
    return responses[i++];
  });
  return { client: { messages: { create } } as unknown as Anthropic, argsPerCall };
}

describe("runTriage", () => {
  it("executes multiple tool_use blocks from one turn in parallel and returns a single tool_result message", async () => {
    const { client, argsPerCall } = scriptedClient([
      // Turn 1: Claude asks for customer + tickets together (parallel)
      fakeMessage({
        stop_reason: "tool_use",
        usage: usage(200, 40),
        content: [
          { type: "tool_use", id: "call_1", name: "lookup_customer", input: { email: "jordan.lee@acme-corp.com" } },
          { type: "tool_use", id: "call_2", name: "fetch_recent_tickets", input: { email: "jordan.lee@acme-corp.com" } },
        ],
      }),
      // Turn 2: Claude creates the ticket
      fakeMessage({
        stop_reason: "tool_use",
        usage: usage(260, 30),
        content: [
          {
            type: "tool_use",
            id: "call_3",
            name: "create_ticket",
            input: { customer_email: "jordan.lee@acme-corp.com", subject: "Double charge", priority: "high", team: "billing_support" },
          },
        ],
      }),
      // Turn 3: final structured answer
      fakeMessage({
        stop_reason: "end_turn",
        usage: usage(300, 60),
        content: [
          {
            type: "text",
            text: JSON.stringify({
              urgency: "high",
              topic: "billing",
              team: "billing_support",
              confidence: 0.95,
              needs_human_review: false,
              summary: "Customer was double-charged for their Pro subscription.",
            }),
            citations: [],
          },
        ],
      }),
    ]);

    const outcome = await runTriage(
      client,
      { customerEmail: "jordan.lee@acme-corp.com", message: "I was charged twice this month." },
      { model: "claude-haiku-4-5" },
    );

    expect(outcome.result.topic).toBe("billing");
    expect(outcome.result.team).toBe("billing_support");
    expect(outcome.meta.turns).toBe(3);
    expect(outcome.meta.toolCalls.map((c) => c.name)).toEqual([
      "lookup_customer",
      "fetch_recent_tickets",
      "create_ticket",
    ]);
    expect(outcome.meta.inputTokens).toBe(760);
    expect(outcome.meta.outputTokens).toBe(130);

    // The SECOND create() call (index 1) is the request sent right after turn 1's
    // 2 parallel tool_use blocks — its last message must carry BOTH tool_results
    // together, not split across separate messages.
    const toolResultMessage = argsPerCall[1].messages.at(-1);
    expect(toolResultMessage.role).toBe("user");
    expect(toolResultMessage.content).toHaveLength(2);
    expect(toolResultMessage.content[0].tool_use_id).toBe("call_1");
    expect(toolResultMessage.content[1].tool_use_id).toBe("call_2");
  });

  it("marks a failed tool call with is_error instead of dropping it", async () => {
    const { client, argsPerCall } = scriptedClient([
      fakeMessage({
        stop_reason: "tool_use",
        usage: usage(100, 20),
        content: [{ type: "tool_use", id: "call_1", name: "not_a_real_tool", input: {} }],
      }),
      fakeMessage({
        stop_reason: "end_turn",
        usage: usage(120, 40),
        content: [
          {
            type: "text",
            text: JSON.stringify({
              urgency: "normal",
              topic: "other",
              team: "customer_success",
              confidence: 0.3,
              needs_human_review: true,
              summary: "Unclear request.",
            }),
            citations: [],
          },
        ],
      }),
    ]);

    const outcome = await runTriage(client, { customerEmail: "x@example.com", message: "test" }, { model: "claude-haiku-4-5" });

    const toolResultMessage = argsPerCall[1].messages.at(-1);
    expect(toolResultMessage.content[0].is_error).toBe(true);
    expect(outcome.result.needs_human_review).toBe(true);
  });
});
