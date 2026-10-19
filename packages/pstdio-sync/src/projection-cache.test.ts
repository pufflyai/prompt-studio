import { expect, test } from "bun:test";
import { fingerprint } from "pstdio-sync-contracts";
import { entryFor } from "./authoring";
import { appendGroups, projectGroups } from "./projection";
import { inspectConflict, resolutionEntry } from "./resolution";
import type { GroupedState, JournalEntry } from "./types";

test("advancing a projection visits only appended entries and matches a full rebuild", async () => {
  const expected = await fingerprint(null);
  const entry = (id: string): JournalEntry => ({
    inputFingerprint: id,
    mutation: {
      operationId: id,
      environmentId: "writer",
      parents: [],
      changes: [{ recordId: id, expectedRevision: 0, baseDeleted: false, value: { expected, next: id } }],
    },
  });
  let visits = 0;
  const original = entry("fixed");
  const state: GroupedState = {
    owner: { workbenchId: "workbench", extensionId: "extension" },
    accepted: null,
    journal: [
      {
        inputFingerprint: original.inputFingerprint,
        get mutation() {
          visits++;
          return original.mutation;
        },
      },
    ],
  };
  const cached = await projectGroups(state, "writer");
  visits = 0;
  const appended = entry("unrelated");
  state.journal.push(appended);
  const advanced = await appendGroups(cached, state, "writer", [appended]);
  expect(cached.read("unrelated").exists).toBe(false);
  expect(cached.read("fixed").value).toBe("fixed");
  expect(visits).toBe(0);
  const rebuilt = await projectGroups(state, "writer");
  expect(cached.read("fixed")).toEqual(rebuilt.read("fixed"));
  expect(advanced.read("unrelated")).toEqual(rebuilt.read("unrelated"));
  expect(advanced.outcomes).toEqual(rebuilt.outcomes);
  expect(advanced.conflicts).toEqual(rebuilt.conflicts);
});

test("an unpublished append cannot change an issued view or retain caller-owned asset data", async () => {
  const state: GroupedState = {
    owner: { workbenchId: "workbench", extensionId: "extension" },
    accepted: null,
    journal: [],
  };
  const original = await projectGroups(state, "writer");
  const asset = { sha256: "a".repeat(64), byteLength: 5, mediaType: "image/png" };
  const entry: JournalEntry = {
    inputFingerprint: "asset",
    mutation: {
      operationId: "asset",
      environmentId: "writer",
      parents: [],
      changes: [{ recordId: "image", expectedRevision: 0, baseDeleted: false, asset: { base: null, next: asset } }],
    },
  };
  state.journal.push(entry);
  const unpublished = await appendGroups(original, state, "writer", [entry]);
  expect(original.read("image").exists).toBe(false);
  expect(unpublished.read("image").asset?.byteLength).toBe(5);
  asset.byteLength = 10;
  expect(unpublished.read("image").asset?.byteLength).toBe(5);
  // Discarding the candidate after rollback leaves the original view reusable.
  expect(original.read("image").exists).toBe(false);
});

test("incremental conflict and resolution projections match rebuilds in both environments", async () => {
  const state: GroupedState = {
    owner: { workbenchId: "workbench", extensionId: "extension" },
    accepted: null,
    journal: [],
  };
  let local = await projectGroups(state, "writer");
  let foreign = await projectGroups(state, "other");
  const base = local.read("note").revision;
  const advance = async (entry: JournalEntry) => {
    state.journal.push(entry);
    local = await appendGroups(local, state, "writer", [entry]);
    foreign = await appendGroups(foreign, state, "other", [entry]);
    for (const [view, environmentId] of [
      [local, "writer"],
      [foreign, "other"],
    ] as const) {
      const rebuilt = await projectGroups(state, environmentId);
      expect(view.read("note")).toEqual(rebuilt.read("note"));
      expect(view.outcomes).toEqual(rebuilt.outcomes);
      expect(view.conflicts).toEqual(rebuilt.conflicts);
    }
  };
  for (const [operationId, value] of [
    ["saved", "saved"],
    ["stale", "alternative"],
  ]) {
    await advance(
      await entryFor(
        state,
        { operationId, edits: [{ recordId: "note", expectedRevision: base, replace: value }] },
        "writer",
      ),
    );
  }
  expect(local.conflicts).toHaveLength(1);
  const inspection = await inspectConflict(state, "writer", "stale");
  await advance(
    await resolutionEntry(
      state,
      {
        operationId: "resolution",
        conflictId: inspection.conflictId,
        capturedOperationIds: inspection.capturedOperationIds,
        expectedConflicts: inspection.expectedConflicts,
        expectedInputs: inspection.expectedInputs,
        choose: "local",
      },
      "writer",
    ),
  );
  expect(local.read("note").value).toBe("alternative");
  expect(local.conflicts).toHaveLength(0);
});
