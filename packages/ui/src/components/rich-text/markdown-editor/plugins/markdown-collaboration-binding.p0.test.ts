import { expect, test } from "bun:test";
import { $getRoot, $getSelection, $isRangeSelection, createEditor, REDO_COMMAND, UNDO_COMMAND } from "lexical";
import { editorNodes } from "../../shared/editor-config";
import type { MarkdownDocumentBinding } from "../../shared/markdown-document-context";
import { markdownSessionFixture } from "../../shared/markdown-session.test-fixture";
import { createMarkdownSourceDocument } from "../../shared/markdown-source-document";
import { bindMarkdownCollaboration } from "./markdown-collaboration-binding";

const fixture = async () => {
  const peer = await markdownSessionFixture();
  const errors: Error[] = [];
  const editor = createEditor({ nodes: editorNodes, onError: (error) => errors.push(error) });
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
    errors,
    bindingRef,
    queueText,
    async stop() {
      stopState();
      stop();
      await peer.dispose();
    },
  };
};

test("own receipts keep subsequent typing buffered until its normal publication boundary", async () => {
  const f = await fixture();
  let release = () => {};
  let submitted = () => {};
  const firstSubmission = new Promise<void>((resolve) => {
    submitted = resolve;
  });
  f.holdSubmit(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
        submitted();
      }),
  );
  try {
    f.queueText();
    await firstSubmission;
    expect(f.session.getSnapshot().text.toString()).toBe("source LOCAL");
    f.queueText();
    f.editor.read(() => {});
    f.holdSubmit();
    release();
    await f.session.flush();
    expect(f.session.getSnapshot().text.toString()).toBe("source LOCAL");
    expect(f.frames).toHaveLength(1);
    await f.session.close();
    expect(f.document.getText("content").toString()).toBe("source LOCAL LOCAL");
  } finally {
    f.holdSubmit();
    release();
    await f.stop();
  }
});

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

test("unload drains Lexical text queued before its update listener reports pending edits", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const events = new EventTarget();
  Object.defineProperty(globalThis, "window", { configurable: true, value: events });
  const f = await fixture();
  try {
    const settled = new Event("beforeunload", { cancelable: true });
    events.dispatchEvent(settled);
    expect(settled.defaultPrevented).toBe(false);
    f.queueText();
    const event = new Event("beforeunload", { cancelable: true });
    Object.defineProperty(event, "returnValue", { configurable: true, writable: true, value: undefined });
    events.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await f.session.flush();
    expect(f.document.getText("content").toString()).toBe("source LOCAL");
  } finally {
    await f.stop();
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
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

test("typing stays immediate while shared edits are batched until a pause", async () => {
  const f = await fixture();
  try {
    f.queueText();
    f.editor.read(() => {});
    f.queueText();
    f.editor.read(() => {});
    f.queueText();
    f.editor.read(() => expect($getRoot().getTextContent()).toBe("source LOCAL LOCAL LOCAL"));
    expect(f.session.getSnapshot().text.toString()).toBe("source");
    await Bun.sleep(350);
    await f.session.flush();
    expect(f.document.getText("content").toString()).toBe("source LOCAL LOCAL LOCAL");
    expect(f.frames).toHaveLength(1);
  } finally {
    await f.stop();
  }
});

test("remote updates drain locally buffered text before reconciliation", async () => {
  const f = await fixture();
  try {
    f.queueText();
    f.editor.read(() => {});
    expect(f.session.getSnapshot().text.toString()).toBe("source");
    f.remote((text) => text.insert(0, "REMOTE "));
    await f.session.flush();
    f.editor.read(() => expect($getRoot().getTextContent()).toBe("REMOTE source LOCAL"));
    expect(f.document.getText("content").toString()).toBe("REMOTE source LOCAL");
  } finally {
    await f.stop();
  }
});

test("undo includes text that is still waiting for its typing pause", async () => {
  const f = await fixture();
  try {
    f.queueText();
    f.editor.read(() => {});
    expect(f.session.getSnapshot().text.toString()).toBe("source");
    f.editor.dispatchCommand(UNDO_COMMAND, undefined);
    await f.session.flush();
    f.editor.read(() => expect($getRoot().getTextContent()).toBe("source"));
    expect(f.document.getText("content").toString()).toBe("source");
  } finally {
    await f.stop();
  }
});

test("undo and redo preserve a retained draft without publishing it", async () => {
  const f = await fixture();
  try {
    const binding = f.bindingRef.current;
    if (!binding || !("createDraft" in binding)) throw new Error("Expected a public session binding");
    const draft = binding.createDraft();
    draft.text.insert(draft.text.length, " KEPT DRAFT");
    draft.retain();
    f.editor.dispatchCommand(UNDO_COMMAND, undefined);
    f.editor.dispatchCommand(REDO_COMMAND, undefined);
    expect(binding.text.toString()).toBe("source KEPT DRAFT");
    expect(f.document.getText("content").toString()).toBe("source");
    expect(f.errors).toEqual([]);
  } finally {
    await f.stop();
  }
});

test("one undo removes a continuous typing burst across periodic publication", async () => {
  const f = await fixture();
  try {
    for (let index = 0; index < 18; index++) {
      f.queueText();
      f.editor.read(() => {});
      await Bun.sleep(80);
    }
    await Bun.sleep(350);
    await f.session.flush();
    f.editor.dispatchCommand(UNDO_COMMAND, undefined);
    await f.session.flush();
    f.editor.read(() => expect($getRoot().getTextContent()).toBe("source"));
    expect(f.document.getText("content").toString()).toBe("source");
    expect(f.errors).toEqual([]);
  } finally {
    await f.stop();
  }
});

test("undo includes Lexical text queued before the update listener runs", async () => {
  const f = await fixture();
  try {
    f.queueText();
    f.editor.dispatchCommand(UNDO_COMMAND, undefined);
    await f.session.flush();
    f.editor.read(() => expect($getRoot().getTextContent()).toBe("source"));
    expect(f.document.getText("content").toString()).toBe("source");
    expect(f.errors).toEqual([]);
  } finally {
    await f.stop();
  }
});

test("separate typing bursts remain separate undo groups", async () => {
  const f = await fixture();
  try {
    f.queueText();
    f.editor.read(() => {});
    await Bun.sleep(600);
    f.queueText();
    f.editor.read(() => {});
    await Bun.sleep(350);
    await f.session.flush();
    f.editor.dispatchCommand(UNDO_COMMAND, undefined);
    await f.session.flush();
    f.editor.read(() => expect($getRoot().getTextContent()).toBe("source LOCAL"));
    expect(f.errors).toEqual([]);
  } finally {
    await f.stop();
  }
});

test("final composition text remains private after write permission is withdrawn", async () => {
  const f = await fixture();
  try {
    const binding = f.bindingRef.current;
    if (!binding || !("isComposing" in binding)) throw new Error("Expected a public session binding");
    binding.setComposing(true);
    f.readonly();
    f.queueText();
    f.editor.read(() => {});
    await Bun.sleep(350);
    expect(binding.text.toString()).toBe("source LOCAL");
    expect(f.document.getText("content").toString()).toBe("source");
    expect(f.frames).toHaveLength(0);
    expect(f.errors).toEqual([]);
  } finally {
    await f.stop();
  }
});
