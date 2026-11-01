import { expect, test } from "bun:test";
import * as Y from "yjs";
import { prepareTextDocumentAdoption } from "./text-document-adoption";
import { saveTextDocument } from "./text-document-edits";
import { seedTextDocument } from "./text-document-seed";
import { editProjectedText } from "./text-file-projection";

test("an outside file edit merges against its projected anchors and preserves an unseen peer insertion", async () => {
  const canonical = new Y.Doc();
  await seedTextDocument(canonical, "first\nlast");
  const baseline = Y.encodeStateAsUpdate(canonical);
  saveTextDocument(canonical, "PEER first\nlast");
  const outside = await editProjectedText(baseline, "first\nLAST");
  const adopted = await prepareTextDocumentAdoption(outside, canonical);
  if (adopted) Y.applyUpdate(canonical, Y.encodeStateAsUpdate(adopted));
  else Y.applyUpdate(canonical, Y.encodeStateAsUpdate(outside));
  expect(canonical.getText("content").toString()).toBe("PEER first\nLAST");
  adopted?.destroy();
  outside.destroy();
  canonical.destroy();
});

test("replaying the same outside file observation retains its exact character identities", async () => {
  const base = new Y.Doc();
  await seedTextDocument(base, "first\nlast");
  const baseline = Y.encodeStateAsUpdate(base);
  const first = await editProjectedText(baseline, "first\nOUTSIDE last");
  const retry = await editProjectedText(baseline, "first\nOUTSIDE last");
  Y.applyUpdate(first, Y.encodeStateAsUpdate(retry));
  expect(first.getText("content").toString()).toBe("first\nOUTSIDE last");
  expect(Y.encodeStateVector(first)).toEqual(Y.encodeStateVector(retry));
  base.destroy();
  first.destroy();
  retry.destroy();
});
