import { expect, test } from "bun:test";
import { captureCheckpoint } from "./checkpoint-capture";
import { createRecordStorage } from "./storage";
import type { GroupedState } from "./types";

const owner = { workbenchId: "w", extensionId: "e" };
const initial = () => {
  const state: GroupedState = { owner, accepted: null, journal: [] };
  return state;
};

test("save-handler writes are captured together without publishing intermediate groups", async () => {
  const state = initial();
  const captured = await captureCheckpoint(state, "a", async (store) => {
    const { records } = createRecordStorage({ owner, environmentId: "a", store });
    for (const value of ["first", "transformed"]) {
      const before = await records.read("projection");
      await records.commit({
        operationId: crypto.randomUUID(),
        edits: [{ recordId: "projection", expectedRevision: before.revision, replace: value }],
      });
    }
    return "result";
  });
  expect(state.journal).toHaveLength(0);
  expect(captured.value).toBe("result");
  expect(captured.changes).toHaveLength(1);
  expect(captured.changes[0].expectedRevision).toBe(0);
  expect(captured.changes[0].value?.next).toBe("transformed");
  expect(captured.parents).toEqual([]);
});

test("a handler failure discards every captured storage write", async () => {
  const state = initial();
  await expect(
    captureCheckpoint(state, "a", async (store) => {
      const { records } = createRecordStorage({ owner, environmentId: "a", store });
      const before = await records.read("projection");
      await records.commit({
        operationId: "write",
        edits: [{ recordId: "projection", expectedRevision: before.revision, replace: "hidden" }],
      });
      throw new Error("handler failed");
    }),
  ).rejects.toThrow("handler failed");
  expect(state.journal).toHaveLength(0);
});

test("a stale second write cannot replace a successful captured write", async () => {
  const state = initial();
  await expect(
    captureCheckpoint(state, "a", async (store) => {
      const { records } = createRecordStorage({ owner, environmentId: "a", store });
      const before = await records.read("projection");
      for (const value of ["first", "stale"])
        await records.commit({
          operationId: value,
          edits: [{ recordId: "projection", expectedRevision: before.revision, replace: value }],
        });
    }),
  ).rejects.toThrow("observe earlier captured writes");
  expect(state.journal).toHaveLength(0);
});
