import { expect, test } from "bun:test";
import * as Y from "yjs";
import { encodeBytes } from "./encoding";
import { textAdoptionsKey, textCheckpoint } from "./text-document-receipts";
import { readTextDocumentSeed, seedTextDocument } from "./text-document-seed";

test("receipts must name their actual source history and cover only known characters", async () => {
  const source = new Y.Doc();
  await seedTextDocument(source, "abc");
  const seed = await readTextDocumentSeed(source);
  const id = Y.createRelativePositionFromTypeIndex(source.getText("content"), 0).item!;
  for (const [key, mapping, message] of [
    ["wrong-history", [], "another source history"],
    [seed.id, [[id.client, 0, 1000000000000, null, null]], "exceeds source history"],
    [seed.id, [[id.client, id.clock, 1, id.client, 1000000000000]], "exceeds canonical history"],
  ] as const) {
    const target = new Y.Doc();
    await seedTextDocument(target, "abc");
    target.getMap(textAdoptionsKey).set(key, { state: textCheckpoint(source), mapping });
    await expect(readTextDocumentSeed(target)).rejects.toThrow(message);
    target.destroy();
  }
  source.destroy();
});

test("receipt checkpoints cannot contain another receipt payload", async () => {
  const source = new Y.Doc();
  const target = new Y.Doc();
  await seedTextDocument(source, "abc");
  await seedTextDocument(target, "abc");
  const seed = await readTextDocumentSeed(source);
  source.getMap(textAdoptionsKey).set("nested", { state: "invalid", mapping: [] });
  target.getMap(textAdoptionsKey).set(seed.id, { state: encodeBytes(Y.encodeStateAsUpdate(source)), mapping: [] });
  await expect(readTextDocumentSeed(target)).rejects.toThrow("nested adoption receipts");
  source.destroy();
  target.destroy();
});

test("invalid insertion origins are rejected with the native text history", async () => {
  const source = new Y.Doc();
  await seedTextDocument(source, "abc");
  source.getMap("text-edit-authors").set("broken", [1, -1]);
  await expect(readTextDocumentSeed(source)).rejects.toThrow("Invalid text insertion author");
  source.destroy();
});

test("adoption mappings refer to content characters rather than metadata items", async () => {
  const source = new Y.Doc();
  const target = new Y.Doc();
  await seedTextDocument(source, "a");
  await seedTextDocument(target, "a");
  const seed = await readTextDocumentSeed(source);
  const from = Y.createRelativePositionFromTypeIndex(source.getText("content"), 0).item!;
  const to = Y.createRelativePositionFromTypeIndex(target.getText("content"), 0).item!;
  for (const mapping of [
    [[from.client, from.clock, 1, to.client, to.clock + 1]],
    [[from.client, from.clock + 1, 1, to.client, to.clock]],
  ]) {
    target.getMap(textAdoptionsKey).set(seed.id, { state: textCheckpoint(source), mapping });
    await expect(readTextDocumentSeed(target)).rejects.toThrow("content characters");
  }
  source.destroy();
  target.destroy();
});
