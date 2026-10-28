import { expect, test } from "bun:test";
import { withIndependentBlockers } from "./dependency-blockers";

const blocker = "Complete T-1 before implementing this dependent contract.";
const prerequisite = (id: string) => ({ id, shorthand: `T-${id}`, aliases: ["T-1"], blockedReason: null });

test("a dependency blocker still names its prerequisite after the prerequisite is renumbered", () => {
  const child = { id: "child", shorthand: "T-2", dependsOn: ["5"], blockedReason: blocker };
  expect(withIndependentBlockers([prerequisite("5"), child]).at(-1)?.blockedReason).toBeNull();
});

test("a blocker number shared by two linked prerequisites stays an independent blocker", () => {
  const child = { id: "child", shorthand: "T-2", dependsOn: ["5", "6"], blockedReason: blocker };
  expect(withIndependentBlockers([prerequisite("5"), prerequisite("6"), child]).at(-1)?.blockedReason).toBe(blocker);
});
