import { expect, test } from "bun:test";
import { createRecordStorage, type GroupedState } from "pstdio-sync";
import { withConflictReadBoundary } from "./conflict-read-boundary";
import { storageObserver } from "./storage-observation";

test("execution blocks dynamic conflicted reads after an effect and leaves independent reads and inspection available", async () => {
  const state: GroupedState = { owner: { workbenchId: "w", extensionId: "e" }, accepted: null, journal: [] };
  const storage = createRecordStorage({
    owner: state.owner,
    environmentId: "writer",
    store: { observer: storageObserver, transaction: async (_owner, run) => run(state) },
  });
  const initial = await storage.records.read("note");
  for (const [operationId, replace] of [
    ["winner", "accepted"],
    ["branch", "retained"],
  ] as const) {
    await storage.records.commit({
      operationId,
      edits: [{ recordId: "note", expectedRevision: initial.revision, replace }],
    });
  }
  const effects: string[] = [];
  await expect(
    withConflictReadBoundary(async () => {
      effects.push("sent");
      await storage.records.read("note");
      effects.push("continued");
    }),
  ).rejects.toThrow("Unresolved storage conflict");
  expect(effects).toEqual(["sent"]);
  await withConflictReadBoundary(async () => {
    expect((await storage.records.read("independent")).exists).toBe(false);
    expect((await storage.records.inspect("branch")).alternatives).toHaveLength(1);
    await expect(storage.records.list()).rejects.toThrow("Unresolved storage conflict");
    await expect(storage.records.read("note", { operationId: "branch" })).rejects.toThrow(
      "Unresolved storage conflict",
    );
    expect(await storage.records.list("independent")).toEqual([]);
  });
  expect((await storage.records.read("note")).value).toBe("accepted");
  expect((await storage.records.inspect("branch")).alternatives[0]!.records[0]!.value).toBe("retained");
});
