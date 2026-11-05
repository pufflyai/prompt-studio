import type { TextEditingSession } from "@pstdio/sdk/extensions";
import type { LexicalEditor } from "lexical";
import {
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_DOWN_COMMAND,
  REDO_COMMAND,
  SKIP_DOM_SELECTION_TAG,
  SKIP_SCROLL_INTO_VIEW_TAG,
  UNDO_COMMAND,
} from "lexical";
import type { RefObject } from "react";
import * as Y from "yjs";
import type { MarkdownDocumentBinding } from "../../shared/markdown-document-context";
import { createMarkdownSessionDocument } from "../../shared/markdown-session-document";
import type { MarkdownSourceDocument } from "../../shared/markdown-source-document";
import { createMarkdownSourcePoints } from "../../shared/markdown-source-points";
import { captureMarkdownTables, type MarkdownTableProjection } from "../../shared/markdown-source-tables";
import { createMarkdownTextDocument } from "../../shared/markdown-text-document";
import { joinFrontmatter, splitFrontmatter } from "../../utils/markdown";
import type { MarkdownDocumentSelection } from "./markdown-collaboration-types";
import { createMarkdownEditBatch } from "./markdown-edit-batch";
import { registerMarkdownEditUnload } from "./markdown-edit-unload";

interface MarkdownCollaborationBindingInput {
  editor: LexicalEditor;
  source: MarkdownSourceDocument;
  document?: Y.Doc;
  session?: TextEditingSession;
  bindingRef: RefObject<MarkdownDocumentBinding | null>;
  callbacks: RefObject<{
    editable: boolean;
    onChange?: (source: string) => void;
    onSelectionChange?: (selection: MarkdownDocumentSelection | null) => void;
  }>;
  onRecovery: (binding: ReturnType<typeof createMarkdownSessionDocument> | null) => void;
}

const remoteTag = "markdown-remote-source";
export const bindMarkdownCollaboration = (input: MarkdownCollaborationBindingInput) => {
  const { editor, source, document, session, bindingRef, callbacks, onRecovery } = input;
  const drain = () => {
    editor.read(() => undefined);
    edits.flush();
  };
  const binding = session
    ? createMarkdownSessionDocument(session, drain)
    : createMarkdownTextDocument(document!, drain);
  bindingRef.current = binding;
  const recoveryChanged = () => {
    const finishing = "isFinishing" in binding && binding.isFinishing();
    editor.setEditable(callbacks.current.editable && !finishing);
    onRecovery(finishing ? binding : null);
  };
  const stopRecovery = "subscribeRecovery" in binding ? binding.subscribeRecovery(recoveryChanged) : () => {};
  let frontmatter = splitFrontmatter(binding.text.toString()).frontmatter;
  let selection: { anchor: Y.RelativePosition; focus: Y.RelativePosition } | null = null;
  let compositionEnded = false;
  let points: ReturnType<typeof createMarkdownSourcePoints> | undefined;
  let tables: MarkdownTableProjection | undefined;
  const captureSelection = (body?: string) => {
    const range = $getSelection();
    if (!$isRangeSelection(range) || !editor.getRootElement()?.contains(globalThis.document.activeElement)) {
      selection = null;
      callbacks.current.onSelectionChange?.(null);
      return;
    }
    points ??= createMarkdownSourcePoints($getRoot(), body ?? source.exportFromLexical($getRoot()));
    selection = {
      anchor: Y.createRelativePositionFromTypeIndex(binding.text, frontmatter.length + points.toSource(range.anchor)),
      focus: Y.createRelativePositionFromTypeIndex(binding.text, frontmatter.length + points.toSource(range.focus)),
    };
    callbacks.current.onSelectionChange?.({
      anchor: Y.encodeRelativePosition(selection.anchor),
      focus: Y.encodeRelativePosition(selection.focus),
    });
  };
  const render = (value: string) => {
    const loaded = splitFrontmatter(value);
    const anchor = selection && Y.createAbsolutePositionFromRelativePosition(selection.anchor, binding.text.doc!);
    const focus = selection && Y.createAbsolutePositionFromRelativePosition(selection.focus, binding.text.doc!);
    editor.update(
      () => {
        source.reconcileFromSource(loaded.body, tables);
        frontmatter = loaded.frontmatter;
        tables = captureMarkdownTables($getRoot(), loaded.body, binding);
        points = undefined;
        if (!anchor || !focus || anchor.type !== binding.text || focus.type !== binding.text) {
          captureSelection(loaded.body);
          return;
        }
        points = createMarkdownSourcePoints($getRoot(), loaded.body);
        const start = points.toPoint(Math.max(0, anchor.index - frontmatter.length));
        const end = points.toPoint(Math.max(0, focus.index - frontmatter.length));
        const next = $createRangeSelection();
        next.anchor.set(start.key, start.offset, start.type);
        next.focus.set(end.key, end.offset, end.type);
        $setSelection(next);
        captureSelection(loaded.body);
      },
      {
        discrete: true,
        tag: [
          remoteTag,
          SKIP_SCROLL_INTO_VIEW_TAG,
          ...(!editor.getRootElement()?.contains(globalThis.document.activeElement) ? [SKIP_DOM_SELECTION_TAG] : []),
        ],
      },
    );
  };
  const releaseComposition = () => {
    if (!compositionEnded || editor.isComposing()) return;
    compositionEnded = false;
    drain();
    void Promise.resolve(binding.setComposing(false)).catch(() => {});
  };
  const canDrain = () => {
    if ("isComposing" in binding && binding.isComposing()) return true;
    const state = session?.getSnapshot();
    if (state && !state.editable) return false;
    if (callbacks.current.editable) return true;
    // Close disables DOM input first. Queued editor work still drains for a writable source.
    return Boolean(state?.closing && state.editable);
  };
  const publishEdits = (group?: object) => {
    if (!canDrain()) return;
    const body = source.exportFromLexical($getRoot());
    const value = joinFrontmatter(frontmatter, body);
    frontmatter = value.slice(0, value.length - body.length);
    if (value !== binding.text.toString() && binding.write(value, group)) callbacks.current.onChange?.(value);
    points = undefined;
    tables = captureMarkdownTables($getRoot(), body, binding);
    captureSelection(body);
  };
  const edits = createMarkdownEditBatch((group) => {
    editor.read(() => {
      // The read also commits any Lexical work queued since the timer fired.
      edits.cancel();
      publishEdits(group);
    });
  });
  const stopUpdates = editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves, tags }) => {
    editorState.read(() => {
      if (tags.has(remoteTag) || tags.has("markdown-initial-import")) return;
      if (dirtyElements.size || dirtyLeaves.size) {
        points = undefined;
        // Public sessions have receive/close barriers. Legacy document callers retain synchronous writes.
        if (session) edits.schedule();
        else publishEdits();
      } else if (!edits.pending()) captureSelection();
    });
    queueMicrotask(releaseComposition);
  });
  const hasPrivateDraft = () => "isFinishing" in binding && (binding.isFinishing() || binding.isComposing());
  const stopUnload = registerMarkdownEditUnload({
    session,
    pending: () => edits.pending() || hasPrivateDraft(),
    drain,
  });
  const stopRemote = binding.subscribe((value, origin) => {
    if (origin === "reset") {
      selection = null;
      tables = undefined;
    }
    render(value);
    if (origin !== "remote" && origin !== "reset") callbacks.current.onChange?.(value);
  });
  const flushCommandEdits = () => {
    if (!session || hasPrivateDraft()) return;
    // Commands already run in Lexical's update context, including edits whose listener has not run yet.
    if (!edits.pending()) edits.schedule();
    edits.cancel();
    publishEdits(edits.group());
  };
  const stopUndo = editor.registerCommand(
    UNDO_COMMAND,
    () => {
      if (!callbacks.current.editable) return false;
      flushCommandEdits();
      binding.undo();
      return true;
    },
    COMMAND_PRIORITY_HIGH,
  );
  const stopRedo = editor.registerCommand(
    REDO_COMMAND,
    () => {
      if (!callbacks.current.editable) return false;
      flushCommandEdits();
      binding.redo();
      return true;
    },
    COMMAND_PRIORITY_HIGH,
  );
  const stopKeys = editor.registerCommand(
    KEY_DOWN_COMMAND,
    (event) => {
      if (!callbacks.current.editable || (!event.ctrlKey && !event.metaKey) || event.key.toLowerCase() !== "z")
        return false;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return false;
      event.preventDefault();
      editor.dispatchCommand(event.shiftKey ? REDO_COMMAND : UNDO_COMMAND, undefined);
      return true;
    },
    COMMAND_PRIORITY_HIGH,
  );
  const beginComposition = () => {
    if (!callbacks.current.editable) return;
    compositionEnded = false;
    drain();
    binding.setComposing(true);
  };
  const endComposition = () => {
    compositionEnded = true;
    queueMicrotask(releaseComposition);
  };
  const blur = () => {
    drain();
    selection = null;
    callbacks.current.onSelectionChange?.(null);
  };
  const stopRoot = editor.registerRootListener((root, previous) => {
    previous?.removeEventListener("compositionstart", beginComposition, true);
    previous?.removeEventListener("compositionend", endComposition);
    previous?.removeEventListener("blur", blur);
    // Lexical can write a placeholder in its start handler. Open the private draft before it runs.
    root?.addEventListener("compositionstart", beginComposition, true);
    root?.addEventListener("compositionend", endComposition);
    root?.addEventListener("blur", blur);
  });
  editor.getEditorState().read(() => {
    tables = captureMarkdownTables($getRoot(), source.exportFromLexical($getRoot()), binding);
  });
  render(binding.text.toString());
  return () => {
    drain();
    edits.cancel();
    stopUnload();
    compositionEnded = false;
    stopUpdates();
    stopRemote();
    stopUndo();
    stopRedo();
    stopKeys();
    stopRoot();
    stopRecovery();
    onRecovery(null);
    const root = editor.getRootElement();
    root?.removeEventListener("compositionstart", beginComposition, true);
    root?.removeEventListener("compositionend", endComposition);
    root?.removeEventListener("blur", blur);
    callbacks.current.onSelectionChange?.(null);
    binding.destroy();
    if (bindingRef.current === binding) bindingRef.current = null;
  };
};
