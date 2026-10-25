import { expect, test } from "bun:test";
import { scaleBackgroundOwner } from "./storage-scale-background";

test("incoming Planner view work targets the owner being opened", () => {
  expect(scaleBackgroundOwner("rich", "board", "incoming").id).toBe("pstdio.pstdio-planner");
  expect(scaleBackgroundOwner("rich", "list", "fold").id).toBe("pstdio.pstdio-planner");
  expect(scaleBackgroundOwner("rich", "short", "incoming").index).toBe(0);
  expect(scaleBackgroundOwner("small", "board", "incoming").rows).toBe(100_000);
});

test("catch-up uses a different owner from either foreground view", () => {
  expect(scaleBackgroundOwner("rich", "board", "other-owner-catchup").index).toBe(1);
  expect(scaleBackgroundOwner("small", "board", "other-owner-catchup").index).toBe(1);
});
