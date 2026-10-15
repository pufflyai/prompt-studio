import { expect, test } from "bun:test";
import { fingerprint, sealMutation } from "../fingerprint";
import type { Snapshot } from "../state";
import { blank, cellFingerprint, sharedChange, visible } from "./documents";
import { stage } from "./staging";

const snapshot = (): Snapshot => ({
  protocolVersion: 1,
  journalSequence: 0,
  scope: { accountId: "a", workbenchId: "w", extensionId: "x" },
  checkpoint: { epoch: "e", sequence: 0 },
  records: {},
  receipts: {},
  conflicts: {},
  publishedRevision: "published-1",
});

async function mutation(changes: Parameters<typeof sealMutation>[0]["changes"]) {
  return sealMutation({
    protocolVersion: 1,
    scope: snapshot().scope,
    environmentId: "local",
    operationId: crypto.randomUUID(),
    parents: [],
    changes,
  });
}

test("a competing asset withholds text and all other records in its group", async () => {
  const state = snapshot();
  const asset = { sha256: "a".repeat(64), byteLength: 1, mediaType: "image/png" };
  state.records.note = { ...blank("note"), revision: 1, asset };
  const group = await mutation([
    {
      recordId: "note",
      expectedRevision: 0,
      baseDeleted: false,
      shared: await sharedChange(blank("note"), [{ kind: "text.insert", index: 0, text: "withheld" }]),
      asset: { base: null, next: { ...asset, sha256: "b".repeat(64) } },
    },
    { recordId: "other", expectedRevision: 0, baseDeleted: false, deleted: true },
  ]);
  const result = await stage(state, group);
  expect(result.status).toBe("conflict");
  expect(result.records).toEqual(state.records);
});

test("independent map keys merge while same-key changes preserve an alternative", async () => {
  const state = snapshot();
  state.records.map = { ...blank("map"), revision: 1, map: { key: "remote" } };
  const edits = async (key: string) =>
    mutation([
      {
        recordId: "map",
        expectedRevision: 0,
        baseDeleted: false,
        shared: {
          kind: "map",
          entries: [{ key, expected: await cellFingerprint({}, key), next: { kind: "set", value: "local" } }],
        },
      },
    ]);
  const independent = await stage(state, await edits("different"));
  expect(independent.status).toBe("accepted");
  expect(independent.records.map.map).toEqual({ key: "remote", different: "local" });
  const same = await stage(state, await edits("key"));
  expect(same.status).toBe("conflict");
  expect(same.records.map.map.key).toBe("remote");
});

test("arbitrary JSON field replacements require their exact base", async () => {
  const state = snapshot();
  state.records.json = { ...blank("json"), revision: 1, value: { a: 1, b: 0 } };
  const group = await mutation([
    {
      recordId: "json",
      expectedRevision: 0,
      baseDeleted: false,
      value: { expected: await fingerprint({ a: 0, b: 0 }), next: { a: 0, b: 1 } },
    },
  ]);
  expect((await stage(state, group)).status).toBe("conflict");
});

test("concurrent list insertions and deletions converge in either order", async () => {
  const initial = blank("list");
  const seed = await mutation([
    {
      recordId: "list",
      expectedRevision: 0,
      baseDeleted: false,
      shared: await sharedChange(initial, [{ kind: "list.insert", index: 0, values: ["base"] }]),
    },
  ]);
  const base = snapshot();
  base.records = (await stage(base, seed)).records;
  const first = await mutation([
    {
      recordId: "list",
      expectedRevision: 1,
      baseDeleted: false,
      shared: await sharedChange(base.records.list, [
        { kind: "list.delete", index: 0, count: 1 },
        { kind: "list.insert", index: 0, values: ["a"] },
      ]),
    },
  ]);
  const second = await mutation([
    {
      recordId: "list",
      expectedRevision: 1,
      baseDeleted: false,
      shared: await sharedChange(base.records.list, [{ kind: "list.insert", index: 1, values: ["b"] }]),
    },
  ]);
  const run = async (order: (typeof first)[]) => {
    let state = structuredClone(base);
    for (const group of order) state = { ...state, records: (await stage(state, group)).records };
    return visible(state.records.list).list;
  };
  expect(await run([first, second])).toEqual(await run([second, first]));
  expect(await run([first, second])).toContain("a");
  expect(await run([first, second])).toContain("b");
  expect(await run([first, second])).not.toContain("base");
});

async function resolutionFixture() {
  const state = snapshot();
  state.records.map = { ...blank("map"), primitive: "map", revision: 1, map: { key: "remote" } };
  const root = await mutation([
    {
      recordId: "map",
      expectedRevision: 0,
      baseDeleted: false,
      value: { expected: await fingerprint(null), next: "local" },
    },
  ]);
  state.receipts[root.operationId] = {
    order: 1,
    operationId: root.operationId,
    fingerprint: root.fingerprint,
    mutation: root,
    status: "conflict",
    checkpoint: null,
    conflictId: root.operationId,
  };
  state.conflicts[root.operationId] = {
    conflictId: root.operationId,
    revision: 1,
    recordIds: ["map"],
    alternativeOperationIds: [root.operationId],
  };
  const proposal = await sealMutation({
    ...root,
    operationId: crypto.randomUUID(),
    parents: [root.operationId],
    changes: [
      {
        recordId: "map",
        expectedRevision: 1,
        baseDeleted: false,
        shared: await sharedChange(blank("map"), [{ kind: "text.insert", index: 0, text: "conversion" }]),
      },
    ],
    resolution: {
      conflictId: root.operationId,
      expectedConflicts: [{ conflictId: root.operationId, revision: 1 }],
      capturedOperationIds: [root.operationId],
      expectedInputs: [{ recordId: "map", revision: 1 }],
    },
  });
  return { state, proposal };
}

test("resolution cannot change a record's established shared primitive", async () => {
  const { state, proposal } = await resolutionFixture();
  const staged = await stage(state, proposal);
  expect(staged.status).toBe("conflict");
  expect(staged.records.map.primitive).toBe("map");
});

test("conflict and input revisions are checked independently on resolutions", async () => {
  const { state, proposal } = await resolutionFixture();
  const value = {
    ...proposal,
    changes: [
      {
        recordId: "map",
        expectedRevision: 1,
        baseDeleted: false,
        value: { expected: await fingerprint(null), next: "resolved" },
      },
    ],
  };
  const staleInput = await sealMutation({
    ...value,
    resolution: { ...proposal.resolution!, expectedInputs: [{ recordId: "map", revision: 0 }] },
  });
  expect((await stage(state, staleInput)).reason).toBe("stale input revision");
  const staleConflict = await sealMutation({
    ...value,
    resolution: {
      ...proposal.resolution!,
      expectedConflicts: [{ conflictId: proposal.resolution!.conflictId, revision: 0 }],
    },
  });
  expect((await stage(state, staleConflict)).reason).toBe("stale conflict revision");
});

test("all permitted map keys preserve their own values", async () => {
  const state = snapshot();
  const group = await mutation([
    {
      recordId: "map",
      expectedRevision: 0,
      baseDeleted: false,
      shared: {
        kind: "map",
        entries: [
          {
            key: "__proto__",
            expected: await cellFingerprint({}, "__proto__"),
            next: { kind: "set", value: { retained: true } },
          },
        ],
      },
    },
  ]);
  const result = await stage(state, group);
  expect(result.status).toBe("accepted");
  expect(Object.hasOwn(result.records.map.map, "__proto__")).toBe(true);
  expect(result.records.map.map.__proto__).toEqual({ retained: true });
});
