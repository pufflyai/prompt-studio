import { expect, test } from "bun:test";
import { applyEditingChanges } from "@pstdio/sdk/extensions";
import { createMemoryStorageDevices } from "@pstdio/sdk/testing";
import type { MarmaladeAction } from "./marmalade.types";
import {
  editMarmalade,
  executeMarmalade,
  loadMarmalade,
  readMarmalade,
  readMarmaladePresentation,
} from "./marmalade-commands";
import { createMarmaladeState } from "./marmalade-data";
import { marmaladeEditingState } from "./marmalade-editing-state";
import { importMarmaladeLegacy } from "./marmalade-migration";
import { marmaladeContext } from "./marmalade-persistence.test-fixture";
import { marmaladeKeys } from "./marmalade-storage";

test.each([
  {
    name: "reorder",
    ids: ["title"],
    action: { type: "reorder", source: "title", target: "artwork", position: "before" },
  },
  { name: "duplicate", ids: ["artwork"], action: { type: "duplicate" } },
  { name: "group", ids: ["caption", "artwork"], action: { type: "group" } },
  { name: "ungroup", ids: ["caption"], action: { type: "ungroup" } },
] satisfies {
  name: string;
  ids: string[];
  action: MarmaladeAction;
}[])("root layer $name produces a lossless JSON acknowledgement and restorable document", async ({
  name,
  ids,
  action,
}) => {
  const fixture = marmaladeContext(name);
  await loadMarmalade.run(fixture.ctx, {});
  await executeMarmalade.run(fixture.ctx, { action: { type: "select", ids } });
  const result = await executeMarmalade.run(fixture.ctx, { action });
  expect(fixture.commits.at(-1)).toStrictEqual(JSON.parse(JSON.stringify(fixture.commits.at(-1))));
  expect(result).toStrictEqual(JSON.parse(JSON.stringify(result)));
  const current = await readMarmalade.run(fixture.ctx, {});
  expect(current.history.undo).toBe(1);
  await executeMarmalade.run(fixture.ctx, { action: { type: "undo" } });
  expect((await readMarmalade.run(fixture.ctx, {})).document).toEqual(createMarmaladeState().document);
});

test("legacy document presentation and undo history migrate once without losing accepted values", async () => {
  const fixture = marmaladeContext("legacy");
  const legacy = {
    ...createMarmaladeState(),
    tool: "hand",
    selectedIds: ["artwork"],
    expandedIds: [],
    zoom: 0.5,
    pan: { x: 13, y: 27 },
  };
  const history = {
    past: [{ document: createMarmaladeState().document, selectedIds: ["caption"], expandedIds: ["caption"] }],
    future: [],
  };
  await fixture.source.records.commit({
    operationId: "legacy",
    edits: [
      { recordId: fixture.storage.records.id("marmalade:great-wave"), replace: JSON.parse(JSON.stringify(legacy)) },
      { recordId: fixture.storage.records.id("marmalade:history"), replace: JSON.parse(JSON.stringify(history)) },
    ],
  });
  const loaded = await loadMarmalade.run(fixture.ctx, {});
  expect<unknown>(loaded.value).toEqual(
    marmaladeEditingState({ ...legacy, tool: "hand", history: { undo: 1, redo: 0 } }),
  );
  expect<unknown>(
    (await fixture.storage.records.read(fixture.storage.records.id(marmaladeKeys.document))).value,
  ).toMatchObject({
    version: 2,
    document: legacy.document,
  });
  expect<unknown>((await fixture.storage.records.read(fixture.storage.records.id("marmalade:history"))).value).toEqual(
    history,
  );
  fixture.reset();
  expect((await loadMarmalade.run(fixture.ctx, {})).value).toEqual(loaded.value);
  expect(fixture.commits).toEqual([]);
});

test("presentation gestures persist only their small channel and restore without document or history reads", async () => {
  const fixture = marmaladeContext("presentation");
  await loadMarmalade.run(fixture.ctx, {});
  const document = await fixture.source.records.read(fixture.storage.records.id(marmaladeKeys.document));
  fixture.reset();
  const actions: MarmaladeAction[] = [
    { type: "tool", tool: "hand" },
    { type: "select", ids: ["artwork"] },
    { type: "expand", id: "caption" },
    { type: "viewport", zoom: 0.5, pan: { x: 7, y: 9 } },
  ];
  for (const [index, action] of actions.entries())
    await executeMarmalade.run(fixture.ctx, { operationId: `presentation:${index}`, action: structuredClone(action) });
  const presentationId = fixture.storage.records.id("marmalade:presentation");
  expect(fixture.reads.every((id) => id === presentationId)).toBe(true);
  expect(fixture.commits).toHaveLength(4);
  for (const commit of fixture.commits) expect(commit.edits.map((edit) => edit.recordId)).toEqual([presentationId]);
  for (const event of fixture.events) expect(event?.recordIds).toEqual([presentationId]);
  expect(await fixture.source.records.read(document.recordId)).toEqual(document);
  const restored = await readMarmalade.run(marmaladeContext("presentation", fixture.source).ctx, {});
  expect(restored).toMatchObject({
    tool: "hand",
    selectedIds: ["artwork"],
    zoom: 0.5,
    pan: { x: 7, y: 9 },
    history: { undo: 0, redo: 0 },
  });
});

test("document undo restores selection and expansion atomically while retaining shared tool and viewport", async () => {
  const fixture = marmaladeContext("atomic-undo");
  await loadMarmalade.run(fixture.ctx, {});
  await executeMarmalade.run(fixture.ctx, { operationId: "select", action: { type: "select", ids: ["caption"] } });
  await executeMarmalade.run(fixture.ctx, { operationId: "delete", action: { type: "delete" } });
  await executeMarmalade.run(fixture.ctx, { operationId: "tool", action: { type: "tool", tool: "hand" } });
  await executeMarmalade.run(fixture.ctx, {
    operationId: "pan",
    action: { type: "viewport", zoom: 0.5, pan: { x: 2, y: 3 } },
  });
  fixture.reset();
  await executeMarmalade.run(fixture.ctx, { operationId: "undo", action: { type: "undo" } });
  const undone = await readMarmalade.run(fixture.ctx, {});
  expect({ value: undone }).toMatchObject({
    value: {
      selectedIds: ["caption"],
      expandedIds: ["caption"],
      tool: "hand",
      zoom: 0.5,
      pan: { x: 2, y: 3 },
      history: { undo: 0, redo: 1 },
    },
  });
  expect(fixture.commits).toHaveLength(1);
  expect(fixture.commits[0].edits.map((edit) => edit.recordId).sort()).toEqual(
    [marmaladeKeys.document, "marmalade:history", "marmalade:presentation"].map(fixture.storage.records.id).sort(),
  );
  await executeMarmalade.run(fixture.ctx, { operationId: "empty", action: { type: "empty" } });
  await expect(
    executeMarmalade.run(fixture.ctx, {
      operationId: "invalid-selection",
      action: { type: "select", ids: ["caption"] },
    }),
  ).rejects.toThrow("Unknown layer");
  await executeMarmalade.run(fixture.ctx, { operationId: "reset", action: { type: "reset" } });
  expect((await readMarmalade.run(fixture.ctx, {})).document.layers).toHaveLength(6);
});

test("lost acknowledgements retry their accepted domain operation without applying it or adding history again", async () => {
  const fixture = marmaladeContext("acknowledgements");
  await loadMarmalade.run(fixture.ctx, {});
  fixture.reset();
  fixture.loseAcknowledgement();
  const input = {
    operationId: "create-once",
    action: { type: "create", id: "stable-layer", kind: "rectangle", x: 20, y: 30 },
  } as const;
  await expect(executeMarmalade.run(fixture.ctx, input)).rejects.toThrow("Acknowledgement lost");
  expect(await executeMarmalade.run(fixture.ctx, input)).toMatchObject({ value: { history: { undo: 1 } } });
  expect(fixture.commits).toHaveLength(1);
  expect(
    (await readMarmalade.run(fixture.ctx, {})).document.layers.filter((layer) => layer.id === "stable-layer"),
  ).toHaveLength(1);
});

test("refused storage outcomes remain failed and do not publish accepted Marmalade state", async () => {
  const fixture = marmaladeContext("refused");
  await loadMarmalade.run(fixture.ctx, {});
  fixture.reset();
  fixture.refuseNext();
  await expect(
    executeMarmalade.run(fixture.ctx, { operationId: "refused", action: { type: "tool", tool: "hand" } }),
  ).rejects.toThrow("Refused");
  expect(fixture.events).toEqual([]);
  expect((await readMarmalade.run(fixture.ctx, {})).tool).toBe("move");
});

test("two offline storage devices converge shared presentation fields through existing ordered project sync", async () => {
  const pair = await createMemoryStorageDevices({ extensionId: "pstdio.extension-lab" });
  const first = marmaladeContext("shared", pair.devices[0]);
  const second = marmaladeContext("shared", pair.devices[1]);
  await loadMarmalade.run(first.ctx, {});
  await pair.merge();
  await executeMarmalade.run(first.ctx, { operationId: "first-tool", action: { type: "tool", tool: "hand" } });
  await executeMarmalade.run(second.ctx, {
    operationId: "second-pan",
    action: { type: "viewport", pan: { x: 8, y: 9 } },
  });
  await pair.merge();
  for (const fixture of [first, second]) {
    const current = await readMarmalade.run(fixture.ctx, {});
    expect(current).toMatchObject({ tool: "hand", pan: { x: 8, y: 9 } });
    fixture.reset();
    expect(await readMarmaladePresentation.run(fixture.ctx, {})).toHaveProperty("changes");
    expect(fixture.reads).toEqual([fixture.storage.records.id("marmalade:presentation")]);
  }
});

test("legacy actions retain an authoritative composed full-document response", async () => {
  const fixture = marmaladeContext("legacy-edit");
  await loadMarmalade.run(fixture.ctx, {});
  fixture.reset();
  expect(
    await editMarmalade.run(fixture.ctx, { action: { type: "text", id: "title", text: "Accepted" } }),
  ).toMatchObject({ history: { undo: 1 } });
  expect(fixture.reads.filter((id) => id === fixture.storage.records.id(marmaladeKeys.document))).toHaveLength(2);
});

test("small presentation reads reconcile IDs removed by another accepted document transition", async () => {
  const fixture = marmaladeContext("removed-layer");
  await loadMarmalade.run(fixture.ctx, {});
  await executeMarmalade.run(fixture.ctx, { operationId: "select", action: { type: "select", ids: ["caption"] } });
  await executeMarmalade.run(fixture.ctx, { operationId: "delete", action: { type: "delete" } });
  await fixture.source.records.commit({
    operationId: "older-offline-selection",
    edits: [
      {
        recordId: fixture.storage.records.id("marmalade:presentation"),
        set: { "/values/selectedIds": ["caption"], "/values/expandedIds": ["caption"] },
      },
    ],
  });
  fixture.reset();
  const result = await readMarmaladePresentation.run(fixture.ctx, {});
  expect(result.changes.find((change) => change.path[0] === "selectedIds")?.value).toEqual([]);
  expect(result.changes.find((change) => change.path[0] === "expandedIds")?.value).toEqual([]);
  expect(fixture.reads).toEqual([fixture.storage.records.id("marmalade:presentation")]);
});

test("concurrent upgrades from divergent offline legacy state retain distinct operation identities and converge", async () => {
  const pair = await createMemoryStorageDevices({ extensionId: "pstdio.extension-lab" });
  const [a, b] = pair.devices;
  const initial = createMarmaladeState();
  const documentId = a.records.id("marmalade:great-wave");
  await a.records.commit({
    operationId: "seed",
    edits: [{ recordId: documentId, replace: JSON.parse(JSON.stringify(initial)) }],
  });
  await pair.merge();
  await a.records.commit({
    operationId: "old-a",
    edits: [{ recordId: documentId, replace: JSON.parse(JSON.stringify({ ...initial, tool: "hand" })) }],
  });
  await b.records.commit({
    operationId: "old-b",
    edits: [{ recordId: documentId, replace: JSON.parse(JSON.stringify({ ...initial, zoom: 2 })) }],
  });
  const first = marmaladeContext("concurrent-upgrade", a);
  const second = marmaladeContext("concurrent-upgrade", b);
  await loadMarmalade.run(first.ctx, {});
  await loadMarmalade.run(second.ctx, {});
  await pair.merge();
  const one = await readMarmalade.run(first.ctx, {});
  const two = await readMarmalade.run(second.ctx, {});
  expect(one).toEqual(two);
  expect(one).toMatchObject({ tool: "hand", zoom: 2 });
});

for (const type of ["presentation", "document"] as const) {
  test(`${type} acknowledgements retain a concurrently accepted shared presentation change`, async () => {
    const fixture = marmaladeContext(`concurrent-ack:${type}`);
    await loadMarmalade.run(fixture.ctx, {});
    fixture.reset();
    fixture.beforeNextCommit(async () => {
      await fixture.source.records.commit({
        operationId: "external-viewport",
        edits: [
          { recordId: fixture.storage.records.id("marmalade:presentation"), set: { "/values/pan": { x: 17, y: 29 } } },
        ],
      });
    });
    const result = await executeMarmalade.run(fixture.ctx, {
      operationId: "local-command",
      action:
        type === "presentation" ? { type: "tool", tool: "hand" } : { type: "text", id: "title", text: "Accepted" },
    });
    if ("changes" in result)
      expect(result.changes.find((change) => change.path[0] === "pan")?.value).toEqual({ x: 17, y: 29 });
    else expect(result.value.pan).toEqual({ x: 17, y: 29 });
    expect(fixture.reads.filter((id) => id === fixture.storage.records.id(marmaladeKeys.document))).toHaveLength(
      type === "presentation" ? 0 : 1,
    );
  });
}

for (const competingDocuments of [false, true]) {
  test(`legacy import preserves the original converged document winner (${competingDocuments ? "competing" : "independent"})`, async () => {
    const pair = await createMemoryStorageDevices({ extensionId: "pstdio.extension-lab" });
    const [a, b] = pair.devices;
    const initial = createMarmaladeState();
    const legacyId = a.records.id("marmalade:great-wave");
    await a.records.commit({
      operationId: "seed",
      edits: [{ recordId: legacyId, replace: JSON.parse(JSON.stringify(initial)) }],
    });
    await pair.merge();
    const changed = structuredClone(initial);
    changed.document.layers[0].x = 20;
    const other = structuredClone(initial);
    if (competingDocuments) other.document.layers[0].x = 40;
    else other.tool = "hand";
    await a.records.commit({
      operationId: "old-a",
      edits: [{ recordId: legacyId, replace: JSON.parse(JSON.stringify(other)) }],
    });
    await b.records.commit({
      operationId: "old-b",
      edits: [{ recordId: legacyId, replace: JSON.parse(JSON.stringify(changed)) }],
    });
    const first = marmaladeContext(`legacy-doc:${competingDocuments}`, a);
    const second = marmaladeContext(`legacy-doc:${competingDocuments}`, b);
    await loadMarmalade.run(first.ctx, {});
    await loadMarmalade.run(second.ctx, {});
    await pair.merge();
    const legacy = (await a.records.read(legacyId)).value;
    const accepted = await readMarmalade.run(first.ctx, {});
    expect(accepted.document).toEqual((legacy as unknown as typeof initial).document);
    if (!competingDocuments) expect(accepted.tool).toBe("hand");
    await pair.merge();
    expect(await readMarmalade.run(second.ctx, {})).toEqual(accepted);
  });
}

test("later legacy imports preserve modern fields even when they returned to their initial value", async () => {
  const fixture = marmaladeContext("modern-authority");
  const initial = createMarmaladeState();
  const legacyId = fixture.storage.records.id("marmalade:great-wave");
  await fixture.source.records.commit({
    operationId: "seed",
    edits: [{ recordId: legacyId, replace: JSON.parse(JSON.stringify(initial)) }],
  });
  await loadMarmalade.run(fixture.ctx, {});
  await executeMarmalade.run(fixture.ctx, { operationId: "modern-hand", action: { type: "tool", tool: "hand" } });
  await executeMarmalade.run(fixture.ctx, { operationId: "modern-move", action: { type: "tool", tool: "move" } });
  await executeMarmalade.run(fixture.ctx, {
    operationId: "modern-text",
    action: { type: "text", id: "title", text: "Modern" },
  });
  const older = structuredClone(initial);
  older.document.layers[0].x = 100;
  older.tool = "hand";
  older.zoom = 2;
  await fixture.source.records.commit({
    operationId: "late-legacy",
    edits: [{ recordId: legacyId, replace: JSON.parse(JSON.stringify(older)) }],
  });
  const imported = await readMarmalade.run(fixture.ctx, {});
  expect(imported.tool).toBe("move");
  expect(imported.zoom).toBe(2);
  expect(imported.document.layers.find((layer) => layer.id === "title")?.text).toBe("Modern");
  expect((await fixture.source.records.read(legacyId)).value).toEqual(JSON.parse(JSON.stringify(older)));
});

test("legacy import retains independent pan coordinates alongside a modern viewport edit", async () => {
  const fixture = marmaladeContext("pan-leaves");
  const initial = createMarmaladeState();
  const legacyId = fixture.storage.records.id("marmalade:great-wave");
  await fixture.source.records.commit({
    operationId: "seed",
    edits: [{ recordId: legacyId, replace: JSON.parse(JSON.stringify(initial)) }],
  });
  await loadMarmalade.run(fixture.ctx, {});
  await executeMarmalade.run(fixture.ctx, {
    operationId: "modern-pan",
    action: { type: "viewport", pan: { x: 17, y: 0 } },
  });
  await fixture.source.records.commit({
    operationId: "legacy-pan",
    edits: [{ recordId: legacyId, set: { "/pan/y": 29, "/document/title": "Shared title" } }],
  });
  expect(await readMarmalade.run(fixture.ctx, {})).toMatchObject({
    pan: { x: 17, y: 29 },
    document: { title: "Shared title" },
  });
});

test("document command patches do not erase a concurrently accepted document field", async () => {
  const fixture = marmaladeContext("document-ack");
  const loaded = await readMarmalade.run(fixture.ctx, {});
  fixture.beforeNextCommit(async () => {
    await fixture.source.records.commit({
      operationId: "external-title",
      edits: [
        { recordId: fixture.storage.records.id(marmaladeKeys.document), set: { "/document/title": "Shared title" } },
      ],
    });
  });
  const result = await executeMarmalade.run(fixture.ctx, {
    operationId: "local-text",
    action: { type: "text", id: "title", text: "Accepted" },
  });
  const current = { ...loaded, document: { ...loaded.document, title: "Shared title" } };
  const projected =
    "value" in result ? result.value : applyEditingChanges(marmaladeEditingState(current), result.changes);
  expect(projected.document).toMatchObject({ title: "Shared title" });
  expect(result.sourceIds).not.toContain("document");
});

test("a competing accepted legacy import is reread without failing the normal document load", async () => {
  const fixture = marmaladeContext("import-race");
  await loadMarmalade.run(fixture.ctx, {});
  await fixture.source.records.commit({
    operationId: "late-legacy",
    edits: [
      {
        recordId: fixture.storage.records.id("marmalade:great-wave"),
        replace: JSON.parse(JSON.stringify({ ...createMarmaladeState(), zoom: 2 })),
      },
    ],
  });
  fixture.beforeNextCommit(() => importMarmaladeLegacy(fixture.source));
  expect(await readMarmalade.run(fixture.ctx, {})).toMatchObject({ zoom: 2 });
});

test("incremental legacy import honors current migration authority", async () => {
  const fixture = marmaladeContext("import-policy");
  await loadMarmalade.run(fixture.ctx, {});
  await fixture.source.records.commit({
    operationId: "late-legacy",
    edits: [
      {
        recordId: fixture.storage.records.id("marmalade:great-wave"),
        replace: JSON.parse(JSON.stringify({ ...createMarmaladeState(), zoom: 2 })),
      },
    ],
  });
  fixture.storage.canMigrate = async () => false;
  fixture.reset();
  expect(await readMarmalade.run(fixture.ctx, {})).toMatchObject({ zoom: 1 });
  expect(fixture.commits).toEqual([]);
  fixture.storage.canMigrate = async () => true;
  expect(await readMarmalade.run(fixture.ctx, {})).toMatchObject({ zoom: 2 });
});

test("a direct modern document mutation first incorporates an accepted legacy document change", async () => {
  const fixture = marmaladeContext("mutation-import");
  await loadMarmalade.run(fixture.ctx, {});
  const legacy = await readMarmalade.run(fixture.ctx, {});
  legacy.document.layers[0].x = 20;
  await fixture.source.records.commit({
    operationId: "legacy-before-command",
    edits: [
      { recordId: fixture.storage.records.id(marmaladeKeys.legacy), replace: JSON.parse(JSON.stringify(legacy)) },
    ],
  });
  await executeMarmalade.run(fixture.ctx, {
    operationId: "modern-text",
    action: { type: "text", id: "title", text: "New text" },
  });
  const accepted = await readMarmalade.run(fixture.ctx, {});
  expect(accepted.document.layers[0].x).toBe(20);
  expect(accepted.document.layers.find((layer) => layer.id === "title")?.text).toBe("New text");
});
