import { expect, test } from "bun:test";
import { shouldRecallNext, shouldRecallPrevious } from "./keyboard-shortcuts";

const event = { key: "", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false };
for (const [key, predicate] of [
  ["ArrowUp", shouldRecallPrevious],
  ["ArrowDown", shouldRecallNext],
] as const) {
  test(`${key} recalls only without modifiers`, () => {
    expect(predicate({ ...event, key })).toBe(true);
    for (const modifier of ["ctrlKey", "metaKey", "shiftKey", "altKey"]) {
      expect(predicate({ ...event, key, [modifier]: true })).toBe(false);
    }
    for (const other of ["Enter", "a", key === "ArrowUp" ? "ArrowDown" : "ArrowUp"]) {
      expect(predicate({ ...event, key: other })).toBe(false);
    }
  });
}
