import { expect, test } from "bun:test";
import * as Y from "yjs";
import { mergeTextDocuments } from "./text-document-adoption";
import { seedTextDocument } from "./text-document-seed";
import { importTextSource } from "./text-source-import";

test("different pre-binding source copies are retained instead of dropping one as unchanged genesis", async () => {
  const first = new Y.Doc();
  const second = new Y.Doc();
  await importTextSource(first, "a".repeat(64), "saved on laptop");
  await importTextSource(second, "a".repeat(64), "saved on desktop");
  await expect(mergeTextDocuments(first, second)).rejects.toThrow("pre-binding");
  expect(first.getText("content").toString()).toBe("saved on laptop");
  expect(second.getText("content").toString()).toBe("saved on desktop");
  first.destroy();
  second.destroy();
});

test("an imported source cannot lose its original bytes to an unimported root", async () => {
  const first = new Y.Doc();
  const second = new Y.Doc();
  await importTextSource(first, "a".repeat(64), "saved source");
  await seedTextDocument(second, "another root");
  await expect(mergeTextDocuments(first, second)).rejects.toThrow("pre-binding");
  first.destroy();
  second.destroy();
});

test("source import provenance survives adoption through an ordinary equal-source root", async () => {
  const first = new Y.Doc();
  const second = new Y.Doc();
  const third = new Y.Doc();
  await importTextSource(first, "a".repeat(64), "saved source");
  await seedTextDocument(second, "saved source");
  const adopted = await mergeTextDocuments(first, second);
  await importTextSource(third, "a".repeat(64), "another source");
  await expect(mergeTextDocuments(adopted, third)).rejects.toThrow("pre-binding");
  first.destroy();
  second.destroy();
  third.destroy();
  adopted.destroy();
});
