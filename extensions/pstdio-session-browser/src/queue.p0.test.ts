import { expect, test } from "bun:test";
import { queueAction } from "./queue";

test("queue edits use the selected request revision rather than a refreshed row", async () => {
  const calls: unknown[] = [];
  await queueAction(
    {
      updateQueuedFollowUp: async (...args: unknown[]) => {
        calls.push(args);
        return {
          queuePosition: 2,
          revision: "saved",
          prompt: "edited",
          model: null,
          params: {},
          attachments: [],
          steeringDelivery: null,
        };
      },
    },
    "session",
    {
      type: "queue",
      operation: "update",
      item: { id: "2", position: 2, revision: "selected", prompt: "old" },
      prompt: "edited",
      values: { harness: { harnessId: "agent", model: "m", params: { effort: "high" } } },
      attachments: [{ id: "file", name: "notes.txt" }],
    },
  );
  expect(calls).toEqual([
    [
      "session",
      2,
      {
        prompt: "edited",
        expectedRevision: "selected",
        model: "m",
        params: { effort: "high" },
        attachments: [{ file_id: "file" }],
      },
    ],
  ]);
});

test("steering refuses a selected request without an active run snapshot", async () => {
  let called = false;
  await expect(
    queueAction(
      {
        steerQueuedFollowUp: async () => {
          called = true;
          return { status: "accepted" as const, deliveryId: "d" };
        },
      },
      "session",
      {
        type: "queue",
        operation: "steer",
        item: { id: "1", position: 1, revision: "r", prompt: "work" },
        values: {},
        attachments: [],
      },
    ),
  ).rejects.toThrow("run");
  expect(called).toBe(false);
});

test("steering carries the run captured with the selected request instead of a later run", async () => {
  const calls: unknown[] = [];
  await queueAction(
    {
      steerQueuedFollowUp: async (...args) => {
        calls.push(args);
        return { status: "accepted", deliveryId: "delivery" };
      },
    },
    "session",
    {
      type: "queue",
      operation: "steer",
      item: { id: "q", position: 3, revision: "selected", prompt: "Work", activeRunStartedAt: "selected-run" },
      values: {},
      attachments: [],
    },
  );
  expect(calls).toEqual([["session", 3, { expectedRevision: "selected", expectedRunStartedAt: "selected-run" }]]);
});

test("editing a queued model B prompt and creating it as new retain source B settings", async () => {
  const calls: unknown[] = [];
  const item = {
    id: "q",
    position: 2,
    revision: "r",
    prompt: "Queued",
    model: "B",
    params: { thinking: "high" },
    values: { harness: { harnessId: "agent", model: "B", params: { thinking: "high" } } },
  };
  const services = {
    followup: async (input: unknown) => {
      calls.push(input);
    },
    updateQueuedFollowUp: async (...input: unknown[]) => {
      calls.push(input);
      return {
        queuePosition: 2,
        revision: "new",
        prompt: "Edited",
        model: "B",
        params: { thinking: "high" },
        attachments: [],
        steeringDelivery: null,
      };
    },
  };
  for (const operation of ["update", "create"] as const)
    await queueAction(services, "s", {
      type: "queue",
      operation,
      item,
      prompt: "Edited prompt",
      values: {},
      attachments: [],
    });
  expect(calls).toEqual([
    [
      "s",
      2,
      { prompt: "Edited prompt", expectedRevision: "r", model: "B", params: { thinking: "high" }, attachments: [] },
    ],
    {
      sessionId: "s",
      prompt: "Edited prompt",
      harness: { harnessId: "agent", model: "B", params: { thinking: "high" } },
      attachments: [],
    },
  ]);
});
