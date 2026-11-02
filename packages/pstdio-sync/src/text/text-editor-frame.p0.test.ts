import { expect, test } from "bun:test";
import * as Y from "yjs";
import { seedTextDocument } from "./text-document-seed";
import { validateTextEditorFrame, validateTextEditorState } from "./text-editor-frame";

test("text recovery history rejects non-text data and formatting in its source root", async () => {
  for (const mutate of [
    (text: Y.Text) => text.insertEmbed(0, { type: "widget" }),
    (text: Y.Text) => text.format(0, 1, { bold: true }),
  ]) {
    const document = new Y.Doc();
    await seedTextDocument(document, "source");
    mutate(document.getText("content"));
    try {
      await expect(validateTextEditorState(Y.encodeStateAsUpdate(document))).rejects.toMatchObject({
        code: "invalid_frame",
      });
    } finally {
      document.destroy();
    }
  }
});
test("plain text transactions including undo and deletions keep valid causal frames", async () => {
  const document = new Y.Doc({ gc: false });
  await seedTextDocument(document, "source");
  const original = Y.encodeStateAsUpdate(document);
  const vector = Y.encodeStateVector(document);
  const undo = new Y.UndoManager(document.getText("content"));
  document.getText("content").insert(0, "authored ");
  undo.stopCapturing();
  document.getText("content").delete(0, 2);
  undo.undo();
  try {
    await validateTextEditorFrame(original, Y.encodeStateAsUpdate(document, vector));
    expect(document.getText("content").toString()).toBe("authored source");
  } finally {
    undo.destroy();
    document.destroy();
  }
});
