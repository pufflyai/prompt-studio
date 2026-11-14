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
import { marmaladeContext } from "./marmalade-persistence.test-fixture";
import { marmaladeJson, marmaladeKeys } from "./marmalade-storage";

test("opening an untouched Marmalade document and presentation reads defaults without writing storage", async () => {
  const fixture = marmaladeContext("initial-defaults");
  fixture.storage.canMigrate = async () => false;
  const initial = await loadMarmalade.run(fixture.ctx, {});
  expect(initial.value).toEqual(
    marmaladeJson(marmaladeEditingState({ ...createMarmaladeState(), history: { undo: 0, redo: 0, boundary: "" } })),
  );
  expect(fixture.commits).toEqual([]);
  fixture.reset();
  await readMarmaladePresentation.run(fixture.ctx, {});
  expect(fixture.reads).toEqual([fixture.storage.records.id(marmaladeKeys.presentation)]);
  expect(fixture.commits).toEqual([]);
});

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

test("undo fences a delayed gesture completion, including when there was no accepted edit to undo", async () => {
  const fixture = marmaladeContext("delayed-gesture");
  await executeMarmalade.run(fixture.ctx, { operationId: "undo", action: { type: "undo" } });
  fixture.reset();
  await executeMarmalade.run(fixture.ctx, {
    operationId: "delayed-completion",
    historyBoundary: "",
    action: { type: "position", id: "title", x: 140 },
  });
  expect(fixture.commits).toHaveLength(0);
  const current = await readMarmalade.run(fixture.ctx, {});
  expect(current.document.layers.find((layer) => layer.id === "title")?.x).toBe(85);
  expect(current.history.undo).toBe(0);
});

test("an accepted gesture retry after undo returns the current value without replaying the old gesture", async () => {
  const fixture = marmaladeContext("accepted-gesture-retry");
  const completed = {
    operationId: "accepted-completion",
    historyBoundary: "",
    action: { type: "position", id: "title", x: 140 },
  } as const;
  await executeMarmalade.run(fixture.ctx, completed);
  await executeMarmalade.run(fixture.ctx, { operationId: "undo", action: { type: "undo" } });
  fixture.reset();
  const retried = await executeMarmalade.run(fixture.ctx, completed);
  expect(retried).toMatchObject({ value: { document: { layers: { "layer:title": { x: 85 } } } } });
  expect(fixture.commits).toHaveLength(0);
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

test("direct document actions return the authoritative composed document", async () => {
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
