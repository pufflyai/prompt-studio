import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
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
import { type RefObject, useEffect, useRef } from "react";
import * as Y from "yjs";
import type { DocumentParticipant } from "../../../primitives/document-participants";
import type { MarkdownDocumentBinding } from "../../shared/markdown-document-context";
import type { MarkdownSourceDocument } from "../../shared/markdown-source-document";
import { createMarkdownSourcePoints } from "../../shared/markdown-source-points";
import { captureMarkdownTables, type MarkdownTableProjection } from "../../shared/markdown-source-tables";
import { createMarkdownTextDocument } from "../../shared/markdown-text-document";
import { joinFrontmatter, splitFrontmatter } from "../../utils/markdown";

export interface MarkdownDocumentSelection {
  anchor: Uint8Array;
  focus: Uint8Array;
}
export interface MarkdownCollaboration {
  document: Y.Doc;
  onSelectionChange?: (selection: MarkdownDocumentSelection | null) => void;
  participants?: readonly (DocumentParticipant & { selection: MarkdownDocumentSelection | null })[];
}
interface CollaborationPluginProps {
  collaboration: MarkdownCollaboration;
  source: MarkdownSourceDocument;
  editable: boolean;
  onChange?: (source: string) => void;
  bindingRef: RefObject<MarkdownDocumentBinding | null>;
}
const remoteTag = "markdown-remote-source";

export const MarkdownCollaborationPlugin = (props: CollaborationPluginProps) => {
  const { collaboration, source, editable, onChange, bindingRef } = props;
  const [editor] = useLexicalComposerContext();
  const { document, onSelectionChange } = collaboration;
  const callbacks = useRef({ editable, onChange, onSelectionChange });
  callbacks.current = { editable, onChange, onSelectionChange };
  useEffect(() => {
    const binding = createMarkdownTextDocument(document, () => editor.read(() => undefined));
    bindingRef.current = binding;
    let frontmatter = splitFrontmatter(binding.text.toString()).frontmatter;
    let selection: { anchor: Y.RelativePosition; focus: Y.RelativePosition } | null = null;
    let compositionEnded = false;
    let points: ReturnType<typeof createMarkdownSourcePoints> | undefined;
    let tables: MarkdownTableProjection | undefined;
    const captureSelection = () => {
      const range = $getSelection();
      if (!$isRangeSelection(range) || !editor.getRootElement()?.contains(globalThis.document.activeElement)) {
        selection = null;
        callbacks.current.onSelectionChange?.(null);
        return;
      }
      points ??= createMarkdownSourcePoints($getRoot(), source.exportFromLexical($getRoot()));
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
            captureSelection();
            return;
          }
          points = createMarkdownSourcePoints($getRoot(), loaded.body);
          const start = points.toPoint(Math.max(0, anchor.index - frontmatter.length));
          const end = points.toPoint(Math.max(0, focus.index - frontmatter.length));
          const next = $createRangeSelection();
          next.anchor.set(start.key, start.offset, start.type);
          next.focus.set(end.key, end.offset, end.type);
          $setSelection(next);
          captureSelection();
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
      binding.setComposing(false);
    };
    const stopUpdates = editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves, tags }) => {
      editorState.read(() => {
        if (
          !tags.has(remoteTag) &&
          !tags.has("markdown-initial-import") &&
          callbacks.current.editable &&
          (dirtyElements.size || dirtyLeaves.size)
        ) {
          const body = source.exportFromLexical($getRoot());
          const value = joinFrontmatter(frontmatter, body);
          frontmatter = value.slice(0, value.length - body.length);
          if (binding.write(value)) callbacks.current.onChange?.(value);
        }
        if (dirtyElements.size || dirtyLeaves.size) {
          points = undefined;
          tables = captureMarkdownTables($getRoot(), source.exportFromLexical($getRoot()), binding);
        }
        captureSelection();
      });
      queueMicrotask(releaseComposition);
    });
    const stopRemote = binding.subscribe((value, origin) => {
      render(value);
      if (origin !== "remote") callbacks.current.onChange?.(value);
    });
    const stopUndo = editor.registerCommand(
      UNDO_COMMAND,
      () => {
        if (!callbacks.current.editable) return false;
        binding.undo();
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
    const stopRedo = editor.registerCommand(
      REDO_COMMAND,
      () => {
        if (!callbacks.current.editable) return false;
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
      compositionEnded = false;
      binding.setComposing(true);
    };
    const endComposition = () => {
      compositionEnded = true;
      queueMicrotask(releaseComposition);
    };
    const blur = () => {
      selection = null;
      callbacks.current.onSelectionChange?.(null);
    };
    const stopRoot = editor.registerRootListener((root, previous) => {
      previous?.removeEventListener("compositionstart", beginComposition);
      previous?.removeEventListener("compositionend", endComposition);
      previous?.removeEventListener("blur", blur);
      root?.addEventListener("compositionstart", beginComposition);
      root?.addEventListener("compositionend", endComposition);
      root?.addEventListener("blur", blur);
    });
    editor.getEditorState().read(() => {
      tables = captureMarkdownTables($getRoot(), source.exportFromLexical($getRoot()), binding);
    });
    render(binding.text.toString());
    return () => {
      compositionEnded = false;
      stopUpdates();
      stopRemote();
      stopUndo();
      stopRedo();
      stopKeys();
      stopRoot();
      const root = editor.getRootElement();
      root?.removeEventListener("compositionstart", beginComposition);
      root?.removeEventListener("compositionend", endComposition);
      root?.removeEventListener("blur", blur);
      callbacks.current.onSelectionChange?.(null);
      binding.destroy();
      if (bindingRef.current === binding) bindingRef.current = null;
    };
  }, [document, source, editor, bindingRef]);
  return null;
};
