import { createDOMRange } from "@lexical/selection";
import { $getNodeByKey, $getRoot, type LexicalEditor } from "lexical";
import * as Y from "yjs";
import type { MarkdownDocumentBinding } from "../../shared/markdown-document-context";
import type { MarkdownSourceDocument } from "../../shared/markdown-source-document";
import { createMarkdownSourcePoints } from "../../shared/markdown-source-points";
import { splitFrontmatter } from "../../utils/markdown";
import type { MarkdownCollaboration, MarkdownDocumentSelection } from "./markdown-collaboration-plugin";

export interface PresenceRectangle {
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface PresenceMarker {
  participant: NonNullable<MarkdownCollaboration["participants"]>[number];
  caret: PresenceRectangle;
  selected: PresenceRectangle[];
  labelWidth: number;
  labelRight: boolean;
  labelBelow: boolean;
}
interface Clip {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const visibleBounds = (element: HTMLElement, container: HTMLElement) => {
  const bounds = container.getBoundingClientRect();
  const clip: Clip = { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom };
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const rect = parent.getBoundingClientRect();
    if (/auto|scroll|hidden|clip/.test(style.overflowX)) {
      clip.left = Math.max(clip.left, rect.left);
      clip.right = Math.min(clip.right, rect.right);
    }
    if (/auto|scroll|hidden|clip/.test(style.overflowY)) {
      clip.top = Math.max(clip.top, rect.top);
      clip.bottom = Math.min(clip.bottom, rect.bottom);
    }
  }
  return clip;
};

const clipRectangle = (rect: DOMRect, clip: Clip, origin: DOMRect) => {
  const left = Math.max(clip.left, rect.left);
  const top = Math.max(clip.top, rect.top);
  const right = Math.min(clip.right, rect.right);
  const bottom = Math.min(clip.bottom, rect.bottom);
  if (right < left || bottom <= top) return null;
  return { left: left - origin.left, top: top - origin.top, width: right - left, height: bottom - top };
};

const resolveSelection = (
  selection: MarkdownDocumentSelection,
  binding: MarkdownDocumentBinding,
  frontmatter: number,
) => {
  try {
    const anchor = Y.createAbsolutePositionFromRelativePosition(
      Y.decodeRelativePosition(selection.anchor),
      binding.text.doc!,
    );
    const focus = Y.createAbsolutePositionFromRelativePosition(
      Y.decodeRelativePosition(selection.focus),
      binding.text.doc!,
    );
    if (!anchor || !focus || anchor.type !== binding.text || focus.type !== binding.text) return null;
    if (anchor.index < frontmatter || focus.index < frontmatter) return null;
    return { anchor: anchor.index - frontmatter, focus: focus.index - frontmatter };
  } catch {
    return null;
  }
};

interface MarkerContext {
  editor: LexicalEditor;
  binding: MarkdownDocumentBinding;
  frontmatter: number;
  points: ReturnType<typeof createMarkdownSourcePoints>;
  clip: Clip;
  origin: DOMRect;
}
const measureMarker = (participant: PresenceMarker["participant"], context: MarkerContext) => {
  if (!participant.selection) return null;
  const { editor, binding, frontmatter, points, clip, origin } = context;
  const selection = resolveSelection(participant.selection, binding, frontmatter);
  if (!selection) return null;
  const start = points.toPoint(selection.anchor);
  const end = points.toPoint(selection.focus);
  const anchorNode = $getNodeByKey(start.key);
  const focusNode = $getNodeByKey(end.key);
  if (!anchorNode || !focusNode) return null;
  const range = createDOMRange(editor, anchorNode, start.offset, focusNode, end.offset);
  const caretRange = createDOMRange(editor, focusNode, end.offset, focusNode, end.offset);
  const caretRect = caretRange?.getClientRects()[0];
  if (!range || !caretRect) return null;
  const caret = clipRectangle(new DOMRect(caretRect.left, caretRect.top, 0, caretRect.height), clip, origin);
  if (!caret) return null;
  const selected: PresenceRectangle[] = [];
  if (selection.anchor !== selection.focus) {
    for (const rect of range.getClientRects()) {
      const visible = clipRectangle(rect, clip, origin);
      if (visible?.width) selected.push(visible);
    }
  }
  const labelRight = caretRect.left > (clip.left + clip.right) / 2;
  return {
    participant,
    caret,
    selected,
    labelRight,
    labelWidth: labelRight ? caretRect.left - clip.left : clip.right - caretRect.left,
    labelBelow: caretRect.top - clip.top < caretRect.height,
  };
};

export const measureMarkdownPresence = (input: {
  editor: LexicalEditor;
  source: MarkdownSourceDocument;
  binding: MarkdownDocumentBinding;
  container: HTMLElement;
  root: HTMLElement;
  participants: readonly PresenceMarker["participant"][];
}) => {
  const { editor, source, binding, container, root, participants } = input;
  const context = {
    editor,
    binding,
    frontmatter: splitFrontmatter(binding.text.toString()).frontmatter.length,
    points: createMarkdownSourcePoints($getRoot(), source.exportFromLexical($getRoot())),
    clip: visibleBounds(root, container),
    origin: container.getBoundingClientRect(),
  };
  return participants.map((participant) => measureMarker(participant, context)).filter((marker) => marker !== null);
};
