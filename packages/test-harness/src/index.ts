export interface TestClock {
  advance(milliseconds: number): void;
  now(): Date;
  nowIso(): string;
}

export function createTestClock(initial: string | Date): TestClock {
  let current = new Date(initial).getTime();

  if (!Number.isFinite(current)) {
    throw new TypeError("Test clock requires a valid initial date");
  }

  return {
    advance(milliseconds) {
      if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
        throw new TypeError("Clock advance must be a nonnegative safe integer");
      }
      current += milliseconds;
    },
    now() {
      return new Date(current);
    },
    nowIso() {
      return new Date(current).toISOString();
    },
  };
}

export function createSequenceId(prefix: string): () => string {
  if (prefix.length > 120 || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(prefix)) {
    throw new TypeError("ID prefix contains unsupported characters");
  }

  let sequence = 0;
  return () => {
    sequence += 1;
    return `${prefix}_${String(sequence).padStart(4, "0")}`;
  };
}
