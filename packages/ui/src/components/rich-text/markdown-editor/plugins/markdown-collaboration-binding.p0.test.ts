import { expect, test } from "bun:test";
import { $getRoot, $getSelection, $isRangeSelection } from "lexical";
import type { MarkdownDocumentBinding } from "../../shared/markdown-document-context";
import { markdownSessionFixture } from "../../shared/markdown-session.test-fixture";
import { createMarkdownSourceDocument } from "../../shared/markdown-source-document";
import { createHeadlessEditor } from "../../shared/transformers/markdown-transformers-test-utils";
import { bindMarkdownCollaboration } from "./markdown-collaboration-binding";

const fixture = async () => {
  const peer = await markdownSessionFixture();
  const editor = createHeadlessEditor();
  const source = createMarkdownSourceDocument("source");
  editor.update(() => source.importToLexical(), { discrete: true });
  const bindingRef: { current: MarkdownDocumentBinding | null } = { current: null };
  const callbacks = { current: { editable: true } };
  const stop = bindMarkdownCollaboration({
    editor,
    source,
    session: peer.session,
    bindingRef,
    callbacks,
    onRecovery: () => {},
  });
  // Reproduce a synchronous parent render of the public closing snapshot before finalizers run.
  const stopState = peer.session.subscribe(() => {
    const state = peer.session.getSnapshot();
    callbacks.current.editable = state.editable && !state.closing;
    editor.setEditable(callbacks.current.editable);
  });
  const queueText = () =>
    editor.update(() => {
      $getRoot().selectEnd();
      const selection = $getSelection();
      if ($isRangeSelection(selection)) selection.insertText(" LOCAL");
    });
  return {
    ...peer,
    editor,
    queueText,
    async stop() {
      stopState();
      stop();
      await peer.dispose();
    },
  };
};

test("ordinary close drains queued Lexical text after disabling new input", async () => {
  const f = await fixture();
  try {
    f.queueText();
    await f.session.close();
    expect(f.editor.isEditable()).toBe(false);
    expect(f.document.getText("content").toString()).toBe("source LOCAL");
  } finally {
    await f.stop();
  }
});

test("close does not authorize queued Markdown mutation after source permission withdrawal", async () => {
  const f = await fixture();
  try {
    f.readonly();
    f.queueText();
    await f.session.close();
    expect(f.document.getText("content").toString()).toBe("source");
    expect(f.frames).toHaveLength(0);
  } finally {
    await f.stop();
  }
});
