import { describe, expect, it } from "vitest";

import { createSequenceId, createTestClock } from "../src/index.js";

describe("createTestClock", () => {
  it("advances deterministically", () => {
    const clock = createTestClock("2026-08-03T10:00:00.000Z");

    clock.advance(1_500);

    expect(clock.nowIso()).toBe("2026-08-03T10:00:01.500Z");
    expect(clock.now()).toEqual(new Date("2026-08-03T10:00:01.500Z"));
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an unsafe advance value: %s",
    (milliseconds) => {
      const clock = createTestClock("2026-08-03T10:00:00.000Z");
      expect(() => clock.advance(milliseconds)).toThrow(TypeError);
    },
  );

  it("rejects an invalid initial date", () => {
    expect(() => createTestClock("not-a-date")).toThrow(TypeError);
  });
});

describe("createSequenceId", () => {
  it("creates stable, increasing identifiers", () => {
    const nextId = createSequenceId("event_test");

    expect(nextId()).toBe("event_test_0001");
    expect(nextId()).toBe("event_test_0002");
  });

  it("rejects unsupported and oversized prefixes", () => {
    expect(() => createSequenceId("not valid")).toThrow(TypeError);
    expect(() => createSequenceId("a".repeat(121))).toThrow(TypeError);
  });
});
