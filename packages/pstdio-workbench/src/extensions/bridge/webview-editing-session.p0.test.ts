import { expect, test } from "bun:test";
import { createHostCapabilityGate } from "pstdio-extensions/bridge/contract";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { createWorkbench } from "../../core";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

const deferred = () => {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const createEditor = (failFirst = false) => {
  const workbench = createWorkbench();
  const writes: unknown[] = [];
  const writing = deferred();
  const release = deferred();
  workbench.commands.registerCommand(
    { id: "pstdio.lab.command.save", label: "Save" },
    {
      execute: async (params) => {
        writes.push(params);
        if (writes.length === 1) {
          writing.resolve();
          await release.promise;
          if (failFirst) throw new Error("Storage is unavailable");
        }
      },
    },
  );
  const frame = (projectId = "project-1", extensionId = "pstdio.lab") => {
    const events: unknown[] = [];
    const hostEvents = createHostEventPublisher();
    hostEvents.bind((event) => events.push(event.payload));
    const capabilities = createWorkbenchWebviewHostCapabilities({ workbench, projectId, extensionId, hostEvents });
    const gate = createHostCapabilityGate({ capabilities, declaredCapabilities: ["editing.session"] });
    return {
      call: (input: object) => gate.call({ method: "editing.session", params: input }),
      events,
      hostEvents,
    };
  };
  return { frame, writes, writing, release };
};
const initial = { title: "Original", position: { x: 0, y: 0 } };
const open = (sessionId: string, key = "document-1") => ({
  operation: "open",
  sessionId,
  key,
  initial,
  save: { commandId: "pstdio.lab.command.save", params: { documentId: key } },
});
const change = (sessionId: string, value: string) => ({
  operation: "commit",
  sessionId,
  sequence: 1,
  changes: [{ path: ["title"], value }],
});

test("publishes an edit to every view while its save is held", async () => {
  const editor = createEditor();
  const inspector = editor.frame();
  const canvas = editor.frame();
  await inspector.call(open("inspector"));
  await canvas.call(open("canvas"));
  const saved = inspector.call(change("inspector", "Latest edit"));
  await editor.writing.promise;
  expect(canvas.events.at(-1)).toMatchObject({
    sessionId: "canvas",
    snapshot: { value: { title: "Latest edit" }, revision: 1, savedRevision: 0 },
  });
  editor.release.resolve();
  await saved;
  expect(canvas.events.at(-1)).toMatchObject({ snapshot: { revision: 1, savedRevision: 1 } });
});

test("coalesces rapid writes from separate views without rolling back newer edits", async () => {
  const editor = createEditor();
  const first = editor.frame();
  const second = editor.frame();
  await first.call(open("first"));
  await second.call(open("second"));
  const saved = first.call(change("first", "A"));
  await editor.writing.promise;
  const pending = [second.call(change("second", "AB")), first.call(change("first", "ABC"))];
  expect(editor.writes).toHaveLength(1);
  expect(second.events.at(-1)).toMatchObject({ snapshot: { value: { title: "ABC" }, revision: 3 } });
  editor.release.resolve();
  await Promise.all([saved, ...pending]);
  expect(editor.writes).toEqual([
    { documentId: "document-1", changes: [{ path: ["title"], value: "A" }] },
    { documentId: "document-1", changes: [{ path: ["title"], value: "ABC" }] },
  ]);
  expect(second.events.at(-1)).toMatchObject({ snapshot: { value: { title: "ABC" }, savedRevision: 3 } });
});

test("previews compound edits across views and cancels without saving", async () => {
  const editor = createEditor();
  const inspector = editor.frame();
  const canvas = editor.frame();
  await inspector.call(open("inspector"));
  await canvas.call(open("canvas"));
  const changes = [
    { path: ["position", "x"], value: 12 },
    { path: ["position", "y"], value: 24 },
  ];
  await inspector.call({ operation: "preview", sessionId: "inspector", sequence: 1, changes });
  expect(canvas.events.at(-1)).toMatchObject({ snapshot: { value: { position: { x: 12, y: 24 } }, revision: 0 } });
  expect(editor.writes).toHaveLength(0);
  await inspector.call({ operation: "cancel", sessionId: "inspector" });
  expect(canvas.events.at(-1)).toMatchObject({ snapshot: { value: initial, revision: 0 } });
  await inspector.call({ operation: "preview", sessionId: "inspector", sequence: 2, changes });
  const saved = inspector.call({ operation: "commit", sessionId: "inspector", sequence: 3, changes: [] });
  await editor.writing.promise;
  expect(editor.writes).toEqual([{ documentId: "document-1", changes }]);
  editor.release.resolve();
  await saved;
});

test("isolates projects, extensions and documents and refuses another frame's session", async () => {
  const editor = createEditor();
  const source = editor.frame();
  const otherProject = editor.frame("project-2");
  const otherExtension = editor.frame("project-1", "pstdio.other");
  const otherDocument = editor.frame();
  await source.call(open("source"));
  await otherProject.call(open("project"));
  await otherExtension.call({ ...open("extension"), save: { commandId: "pstdio.other.command.save" } });
  await otherDocument.call(open("document", "document-2"));
  const saved = source.call(change("source", "Private edit"));
  await editor.writing.promise;
  for (const other of [otherProject, otherExtension, otherDocument]) {
    expect(other.events).toEqual([]);
  }
  await expect(otherDocument.call(change("source", "Hijacked"))).rejects.toThrow();
  editor.release.resolve();
  await saved;
});

test("late views join the latest state and disposed views cannot mutate it", async () => {
  const editor = createEditor();
  const first = editor.frame();
  await first.call(open("first"));
  const saved = first.call(change("first", "Pending edit"));
  await editor.writing.promise;
  first.hostEvents.unbind();
  const second = editor.frame();
  expect(await second.call(open("second"))).toMatchObject({ value: { title: "Pending edit" } });
  await expect(first.call(change("first", "Stale connection"))).rejects.toThrow();
  editor.release.resolve();
  await saved;
  await second.call({ operation: "close", sessionId: "second" });
  expect(await editor.frame().call(open("fresh"))).toMatchObject({ value: initial });
});

test("a failed save retains edits for every view and can be retried", async () => {
  const editor = createEditor(true);
  const source = editor.frame();
  await source.call(open("source"));
  const failed = source.call(change("source", "Keep this edit")).catch((error: unknown) => error);
  await editor.writing.promise;
  editor.release.resolve();
  expect(await failed).toMatchObject({ message: "Storage is unavailable" });
  const other = editor.frame();
  expect(await other.call(open("other"))).toMatchObject({
    value: { title: "Keep this edit" },
    revision: 1,
    savedRevision: 0,
  });
  await other.call({ operation: "save", sessionId: "other" });
  expect(editor.writes).toHaveLength(2);
  expect(source.events.at(-1)).toMatchObject({ snapshot: { value: { title: "Keep this edit" }, savedRevision: 1 } });
});

test("stale backend reads do not replace edits or previews", async () => {
  const editor = createEditor();
  const frame = editor.frame();
  await frame.call(open("source"));
  await frame.call({
    operation: "preview",
    sessionId: "source",
    sequence: 1,
    changes: [{ path: ["title"], value: "Draft" }],
  });
  expect(
    await frame.call({ operation: "refresh", sessionId: "source", expectedVersion: 0, value: initial }),
  ).toBeUndefined();
  const saved = frame.call({ operation: "commit", sessionId: "source", sequence: 2, changes: [] });
  await editor.writing.promise;
  expect(
    await frame.call({ operation: "refresh", sessionId: "source", expectedVersion: 2, value: initial }),
  ).toBeUndefined();
  editor.release.resolve();
  await saved;
});

test("structural commits cancel incompatible previews before accepting and saving the edit", async () => {
  const editor = createEditor();
  const first = editor.frame();
  const second = editor.frame();
  await first.call(open("first"));
  await second.call(open("second"));
  await first.call({
    operation: "preview",
    sessionId: "first",
    sequence: 1,
    changes: [{ path: ["position", "x"], value: 12 }],
  });
  const saved = second.call({
    operation: "commit",
    sessionId: "second",
    sequence: 1,
    changes: [{ path: ["position"], value: null }],
  });
  editor.release.resolve();
  await saved;
  expect(editor.writes).toEqual([{ documentId: "document-1", changes: [{ path: ["position"], value: null }] }]);
  expect(await editor.frame().call(open("third"))).toMatchObject({
    value: { position: null },
    revision: 1,
    savedRevision: 1,
  });
  expect(await first.call({ operation: "cancel", sessionId: "first" })).toMatchObject({ value: { position: null } });
});

test("backend refreshes cancel incompatible previews without blocking new views", async () => {
  const editor = createEditor();
  const frame = editor.frame();
  await frame.call(open("source"));
  await frame.call({
    operation: "preview",
    sessionId: "source",
    sequence: 1,
    changes: [{ path: ["position", "x"], value: 12 }],
  });
  expect(
    await frame.call({
      operation: "refresh",
      sessionId: "source",
      expectedVersion: 1,
      value: { ...initial, position: null },
    }),
  ).toMatchObject({ value: { position: null } });
  expect(await editor.frame().call(open("other"))).toMatchObject({ value: { position: null } });
  expect(editor.writes).toHaveLength(0);
});

for (const operation of ["cancel", "close"])
  test(`removing a preview with ${operation} cancels drafts that depended on it`, async () => {
    const editor = createEditor();
    const first = editor.frame();
    const second = editor.frame();
    const third = editor.frame();
    await first.call(open("first"));
    await second.call(open("second"));
    await third.call(open("third"));
    await first.call({
      operation: "preview",
      sessionId: "first",
      sequence: 1,
      changes: [{ path: ["position"], value: { x: 0 } }],
    });
    await second.call({
      operation: "preview",
      sessionId: "second",
      sequence: 1,
      changes: [{ path: ["position", "x"], value: 12 }],
    });
    const saved = third.call({
      operation: "commit",
      sessionId: "third",
      sequence: 1,
      changes: [{ path: ["position"], value: null }],
    });
    editor.release.resolve();
    await saved;
    await first.call({ operation, sessionId: "first" });
    expect(await editor.frame().call(open("fourth"))).toMatchObject({ value: { position: null }, savedRevision: 1 });
    expect(second.events.at(-1)).toMatchObject({ snapshot: { value: { position: null } } });
  });

test("save commands stay with the calling extension", async () => {
  const editor = createEditor();
  await expect(
    editor.frame().call({ ...open("source"), save: { commandId: "pstdio.other.command.save" } }),
  ).rejects.toThrow("editing_save_not_owner");
});
