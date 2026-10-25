import { describe, expect, test } from "bun:test";
import type { QueuedFollowUp } from "./message-types";
import { moveQueuedFollowUp, reorderQueuedFollowUp } from "./queued-follow-up-list-state";

const queuedItems: QueuedFollowUp[] = [
  { id: "queued-1", prompt: "First" },
  { id: "queued-2", prompt: "Second" },
  { id: "queued-3", prompt: "Third" },
];

describe("moveQueuedFollowUp", () => {
  test("moves a queued follow-up by one slot", () => {
    expect(moveQueuedFollowUp(queuedItems, "queued-2", "up").map((item) => item.id)).toEqual([
      "queued-2",
      "queued-1",
      "queued-3",
    ]);
    expect(moveQueuedFollowUp(queuedItems, "queued-2", "down").map((item) => item.id)).toEqual([
      "queued-1",
      "queued-3",
      "queued-2",
    ]);
  });

  test("keeps boundary and missing items in place", () => {
    expect(moveQueuedFollowUp(queuedItems, "queued-1", "up")).toEqual(queuedItems);
    expect(moveQueuedFollowUp(queuedItems, "queued-3", "down")).toEqual(queuedItems);
    expect(moveQueuedFollowUp(queuedItems, "missing", "up")).toEqual(queuedItems);
  });

  test("moves a queued follow-up by multiple slots", () => {
    expect(moveQueuedFollowUp(queuedItems, "queued-1", "down", 2).map((item) => item.id)).toEqual([
      "queued-2",
      "queued-3",
      "queued-1",
    ]);
  });
});

describe("reorderQueuedFollowUp", () => {
  test("moves a queued follow-up to a target index", () => {
    expect(reorderQueuedFollowUp(queuedItems, "queued-1", 2).map((item) => item.id)).toEqual([
      "queued-2",
      "queued-3",
      "queued-1",
    ]);
    expect(reorderQueuedFollowUp(queuedItems, "queued-3", 0).map((item) => item.id)).toEqual([
      "queued-3",
      "queued-1",
      "queued-2",
    ]);
  });

  test("keeps missing and same-index items in place", () => {
    expect(reorderQueuedFollowUp(queuedItems, "missing", 1)).toEqual(queuedItems);
    expect(reorderQueuedFollowUp(queuedItems, "queued-2", 1)).toEqual(queuedItems);
  });
});
