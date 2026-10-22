import { expect, test } from "bun:test";
import { createSessionResourceDeadlines } from "./session-resource-deadlines";

test("renewed and cancelled deadlines keep the earliest remaining owner first", () => {
  const deadlines = createSessionResourceDeadlines<number>();
  const expected = new Map<number, number>();
  for (let index = 0; index < 10_000; index++) {
    const at = (index * 7919) % 10_000;
    deadlines.set(index, at);
    expected.set(index, at);
  }
  for (let index = 0; index < 10_000; index += 3) {
    deadlines.delete(index);
    expected.delete(index);
  }
  for (let index = 1; index < 10_000; index += 5) {
    const at = 20_000 - index;
    deadlines.set(index, at);
    expected.set(index, at);
  }
  const ordered = [...expected.values()].sort((a, b) => a - b);
  for (const at of ordered) {
    const first = deadlines.first();
    expect(first?.at).toBe(at);
    deadlines.delete(first!.value);
  }
  expect(deadlines.first()).toBeUndefined();
});
