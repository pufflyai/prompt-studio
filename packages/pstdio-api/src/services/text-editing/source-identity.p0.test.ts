import { expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as Y from "yjs";
import { editorView, selected, textEditingFixture } from "./text-editing.test-fixture";

test("the source identity fence checks the actual resolved authority before creating a room", async () => {
  let root = "";
  let replace = false;
  const f = await textEditingFixture({
    beforeDocumentAccess: async () => {
      if (replace) {
        replace = false;
        await writeFile(join(root, "alternate-source"), "");
      }
    },
  });
  root = f.root;
  try {
    const address = {
      projectId: "project-1",
      token: (await f.text.connect("project-1", { kind: "agent", target: selected })).token,
    };
    const grant = (await f.text.request(address, { operation: "current" }))!;
    const first = crypto.randomUUID();
    await f.text.request(address, { operation: "register", memberId: first });
    const opened = await f.text.request(address, { operation: "open", memberId: first, input: { grant } });
    await f.text.request(address, { operation: "close", handle: opened.handle });
    await writeFile(join(root, "replacement.txt"), "Replacement source");
    const next = crypto.randomUUID();
    await f.text.request(address, { operation: "register", memberId: next });
    replace = true;
    await expect(
      f.text.request(address, {
        operation: "open",
        memberId: next,
        input: { grant },
        sourceIdentity: opened.sourceIdentity,
      }),
    ).rejects.toMatchObject({ code: "source_retired" });
    expect(f.documents.sources.current({ workbenchId: "project-1", extensionId: "example.context" })).toEqual([]);
    expect(await readFile(join(root, "replacement.txt"), "utf8")).toBe("Replacement source");
  } finally {
    await f.cleanup();
  }
});

test("the actual source access rejects recovery after its owner withdraws the selected presentation", async () => {
  let root = "";
  let withdraw = false;
  const f = await textEditingFixture({
    beforeDocumentAccess: async () => {
      if (withdraw) {
        withdraw = false;
        await writeFile(join(root, "native"), "");
      }
    },
  });
  root = f.root;
  const document = new Y.Doc({ gc: false });
  try {
    const address = {
      projectId: "project-1",
      token: (await f.text.connect("project-1", { kind: "placement", viewId: editorView, target: selected })).token,
    };
    const grant = (await f.text.request(address, { operation: "current" }))!;
    const first = crypto.randomUUID();
    await f.text.request(address, { operation: "register", memberId: first });
    const opened = await f.text.request(address, { operation: "open", memberId: first, input: { grant } });
    await f.text.request(address, { operation: "close", handle: opened.handle });
    Y.applyUpdate(document, Buffer.from(opened.snapshot.state, "base64"));
    const vector = Y.encodeStateVector(document);
    document.getText("content").insert(0, "withdrawn edit ");
    const next = crypto.randomUUID();
    await f.text.request(address, { operation: "register", memberId: next });
    withdraw = true;
    await expect(
      f.text.request(address, {
        operation: "open",
        memberId: next,
        input: { grant },
        sourceIdentity: opened.sourceIdentity,
        sourceState: opened.snapshot.state,
        pendingUpdate: Buffer.from(Y.encodeStateAsUpdate(document, vector)).toString("base64"),
      }),
    ).rejects.toMatchObject({ code: "capability_denied" });
    expect(f.documents.sources.current({ workbenchId: "project-1", extensionId: "example.context" })).toEqual([]);
    expect(await readFile(join(root, "notes.txt"), "utf8")).toBe("selected folder");
  } finally {
    document.destroy();
    await f.cleanup();
  }
});
