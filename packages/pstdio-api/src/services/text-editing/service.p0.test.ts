import { afterEach, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as Y from "yjs";
import { editorView, selected, textEditingFixture } from "./text-editing.test-fixture";

const fixtures: Awaited<ReturnType<typeof textEditingFixture>>[] = [];
afterEach(async () => {
  for (const fixture of fixtures.splice(0)) await fixture.cleanup();
});
const setup = async () => {
  const f = await textEditingFixture();
  fixtures.push(f);
  return f;
};
const connect = async (f: Awaited<ReturnType<typeof setup>>, target = selected) => ({
  projectId: "project-1",
  token: (await f.text.connect("project-1", { kind: "placement", viewId: editorView, target })).token,
});
const open = async (
  f: Awaited<ReturnType<typeof setup>>,
  connection: Awaited<ReturnType<typeof connect>>,
  input: object,
) => {
  const memberId = crypto.randomUUID();
  await f.text.request(connection, { operation: "register", memberId });
  return f.text.request(connection, { operation: "open", memberId, input } as never);
};

test("selected source grants admit a different publisher without exposing unselected source ownership", async () => {
  const f = await setup();
  const connection = await connect(f);
  const grant = await f.text.request(connection, { operation: "current" });
  expect(grant).toHaveProperty("token");
  const opened = await open(f, connection, { grant });
  expect(opened).toHaveProperty("handle");
  const own = await open(f, connection, { sourceId: "body", params: {} });
  expect(own).toHaveProperty("handle");
  expect((own as { snapshot: { state: string } }).snapshot.state).not.toBe(
    (opened as { snapshot: { state: string } }).snapshot.state,
  );
  await expect(
    open(f, connection, { extensionId: "example.context", sourceId: "body", params: {} }),
  ).rejects.toMatchObject({ code: "invalid_frame" });
});

test("a copied grant or handle cannot cross member placements or projects", async () => {
  const f = await setup();
  const first = await connect(f);
  const second = await connect(f);
  const grant = await f.text.request(first, { operation: "current" });
  const opened = (await open(f, first, { grant })) as { handle: string };
  await expect(open(f, second, { grant })).rejects.toMatchObject({ code: "grant_invalid" });
  await expect(f.text.request(second, { operation: "snapshot", handle: opened.handle })).rejects.toMatchObject({
    code: "session_closed",
  });
  await expect(
    f.text.request({ ...first, projectId: "project-other" }, { operation: "snapshot", handle: opened.handle }),
  ).rejects.toMatchObject({ code: "grant_invalid" });
});

test("native presentation and custom presentation must match the source owner's selection", async () => {
  const f = await setup();
  await expect(f.text.connect("project-1", { kind: "placement", target: selected })).rejects.toMatchObject({
    code: "capability_denied",
  });
  await writeFile(join(f.root, "native"), "");
  await expect(connect(f)).rejects.toMatchObject({ code: "capability_denied" });
  const native = await f.text.connect("project-1", { kind: "placement", target: selected });
  expect(native).toHaveProperty("token");
});

test("read-only admission and capability withdrawal are rechecked before text mutation", async () => {
  const f = await setup();
  await writeFile(join(f.root, "read-only"), "");
  const connection = await connect(f);
  const grant = await f.text.request(connection, { operation: "current" });
  const opened = (await open(f, connection, { grant })) as { handle: string; snapshot: { editable: boolean } };
  expect(opened.snapshot.editable).toBe(false);
  await expect(
    f.text.request(connection, { operation: "submit", handle: opened.handle, sequence: 1, update: "AAA=" }),
  ).rejects.toMatchObject({ code: "source_read_only" });
  f.disableEditor();
  await expect(f.text.request(connection, { operation: "snapshot", handle: opened.handle })).rejects.toMatchObject({
    code: "capability_denied",
  });
});

test("text frames cannot write host metadata or unrelated roots", async () => {
  const f = await setup();
  const connection = await connect(f);
  const grant = await f.text.request(connection, { operation: "current" });
  const opened = (await open(f, connection, { grant })) as { handle: string; snapshot: { state: string } };
  const source = new Y.Doc();
  Y.applyUpdate(source, Buffer.from(opened.snapshot.state, "base64"));
  const vector = Y.encodeStateVector(source);
  source.getMap("unrelated").set("value", "not source text");
  const update = Buffer.from(Y.encodeStateAsUpdate(source, vector)).toString("base64");
  await expect(
    f.text.request(connection, { operation: "submit", handle: opened.handle, sequence: 1, update }),
  ).rejects.toMatchObject({ code: "invalid_frame" });
  const memberId = crypto.randomUUID();
  await f.text.request(connection, { operation: "register", memberId });
  await expect(
    f.text.request(connection, {
      operation: "open",
      memberId,
      input: { grant: grant as { token: string } },
      sourceState: Buffer.from(Y.encodeStateAsUpdate(source)).toString("base64"),
    }),
  ).rejects.toMatchObject({ code: "invalid_frame" });
  source.destroy();
});

test("read-only history recovery cannot smuggle canonical text without a pending frame", async () => {
  const f = await setup();
  await writeFile(join(f.root, "read-only"), "");
  const connection = await connect(f);
  const grant = await f.text.request(connection, { operation: "current" });
  const original = (await open(f, connection, { grant })) as { handle: string; snapshot: { state: string } };
  const document = new Y.Doc();
  Y.applyUpdate(document, Buffer.from(original.snapshot.state, "base64"));
  document.getText("content").insert(0, "SMUGGLED ");
  const memberId = crypto.randomUUID();
  await f.text.request(connection, { operation: "register", memberId });
  try {
    await expect(
      f.text.request(connection, {
        operation: "open",
        memberId,
        input: { grant: grant! },
        sourceState: Buffer.from(Y.encodeStateAsUpdate(document)).toString("base64"),
      }),
    ).rejects.toMatchObject({ code: "source_read_only" });
    const snapshot = await f.text.request(connection, { operation: "snapshot", handle: original.handle });
    const current = new Y.Doc();
    try {
      Y.applyUpdate(current, Buffer.from(snapshot.state, "base64"));
      expect(current.getText("content").toString()).toBe("selected folder");
    } finally {
      current.destroy();
    }
  } finally {
    document.destroy();
  }
});

test("permission withdrawal is reflected in snapshots before the next mutation", async () => {
  const f = await setup();
  const connection = await connect(f);
  const grant = await f.text.request(connection, { operation: "current" });
  const original = (await open(f, connection, { grant })) as { handle: string };
  await writeFile(join(f.root, "read-only"), "");
  expect((await f.text.request(connection, { operation: "snapshot", handle: original.handle })).editable).toBe(false);
});

test("a lost durable acknowledgement can settle after write permission is withdrawn", async () => {
  const f = await setup();
  const connection = await connect(f);
  const grant = await f.text.request(connection, { operation: "current" });
  const original = (await open(f, connection, { grant })) as { handle: string; snapshot: { state: string } };
  const document = new Y.Doc();
  Y.applyUpdate(document, Buffer.from(original.snapshot.state, "base64"));
  const vector = Y.encodeStateVector(document);
  document.getText("content").insert(0, "Saved ");
  const update = Buffer.from(Y.encodeStateAsUpdate(document, vector)).toString("base64");
  try {
    const request = { operation: "submit" as const, handle: original.handle, sequence: 1, update };
    const receipt = await f.text.request(connection, request);
    await f.text.request(connection, { operation: "project", handle: original.handle, revision: receipt.revision });
    await writeFile(join(f.root, "read-only"), "");
    expect(await f.text.request(connection, request)).toEqual({ ...receipt, editable: false });
    await expect(f.text.request(connection, { ...request, sequence: 2 })).rejects.toMatchObject({
      code: "source_read_only",
    });
  } finally {
    document.destroy();
  }
});

test("a recovery receipt settles the same frozen draft after write permission is withdrawn", async () => {
  const f = await setup();
  const connection = await connect(f);
  const grant = await f.text.request(connection, { operation: "current" });
  const original = (await open(f, connection, { grant })) as { snapshot: { state: string } };
  const document = new Y.Doc();
  Y.applyUpdate(document, Buffer.from(original.snapshot.state, "base64"));
  const vector = Y.encodeStateVector(document);
  document.getText("content").insert(0, "Draft ");
  const memberId = crypto.randomUUID();
  await f.text.request(connection, { operation: "register", memberId });
  const request = {
    operation: "open" as const,
    memberId,
    input: { grant: grant! },
    sourceState: original.snapshot.state,
    pendingUpdate: Buffer.from(Y.encodeStateAsUpdate(document, vector)).toString("base64"),
  };
  try {
    const receipt = await f.text.request(connection, request);
    await f.text.request(connection, {
      operation: "project",
      handle: receipt.handle,
      revision: receipt.snapshot.revision,
    });
    await writeFile(join(f.root, "read-only"), "");
    expect(await f.text.request(connection, request)).toEqual({
      ...receipt,
      snapshot: { ...receipt.snapshot, editable: false },
    });
  } finally {
    document.destroy();
  }
});
