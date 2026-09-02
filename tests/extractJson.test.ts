import { describe, it, expect } from "vitest";
import { extractJson } from "../src/triager/schema";

describe("extractJson", () => {
  it("returns plain JSON text unchanged", () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
  });

  it("strips ```json fences", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("strips bare ``` fences", () => {
    expect(extractJson('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("trims surrounding whitespace", () => {
    expect(extractJson('  \n{"a":1}\n  ')).toBe('{"a":1}');
  });

  it("extracts JSON even with prose before and after it", () => {
    expect(extractJson('I think this is straightforward.\n{"a":1}\nDone.')).toBe('{"a":1}');
  });
});
