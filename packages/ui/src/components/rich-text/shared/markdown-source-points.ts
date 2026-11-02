import { $getNodeByKey, $isElementNode, $isTextNode, type ElementNode, type LexicalNode } from "lexical";
import { exportLexicalToMarkdown } from "./markdown-export";
import { buildSourceMap, mappedInsertion } from "./markdown-source-map";

interface SourcePoint {
  key: string;
  offset: number;
  type: "text" | "element";
}
interface SourceSpan {
  node: LexicalNode;
  kind: "text" | "inline" | "block";
  start: number;
  end: number;
}

const textNodes = (node: LexicalNode) => {
  if ($isTextNode(node)) return [node];
  return $isElementNode(node) ? node.getAllTextNodes() : [];
};

const elementSource = (point: SourcePoint, byKey: Map<string, number[]>, fallback: number) => {
  const node = $getNodeByKey(point.key);
  if (!$isElementNode(node)) return fallback;
  const children = node.getChildren();
  for (const child of children.slice(point.offset)) {
    const first = textNodes(child)[0];
    const offset = first && byKey.get(first.getKey())?.[0];
    if (offset !== undefined) return offset;
  }
  for (const child of children.slice(0, point.offset).reverse()) {
    const last = textNodes(child).at(-1);
    const offset = last && byKey.get(last.getKey())?.at(-1);
    if (offset !== undefined) return offset;
  }
  return fallback;
};

const markedSourceSpans = (root: ElementNode, canonical: string) => {
  let salt = "p";
  while (canonical.includes(`\uE000${salt}`)) salt += "p";
  const prefix = `\uE000${salt}`;
  const spans: SourceSpan[] = [];
  const annotate = (node: LexicalNode, kind: SourceSpan["kind"]) => {
    const index = spans.length;
    spans.push({ node, kind, start: -1, end: -1 });
    return { before: `${prefix}${index}s\uE001`, after: `${prefix}${index}e\uE001` };
  };
  const marked = exportLexicalToMarkdown(root, {
    text(node) {
      const marker = annotate(node, "text");
      return marker.before + node.getTextContent() + marker.after;
    },
    inline(node, content) {
      const marker = annotate(node, "inline");
      return [{ type: "text", value: marker.before }, ...content, { type: "text", value: marker.after }];
    },
    block(node, content) {
      const marker = annotate(node, "block");
      return [
        { type: "html", value: marker.before },
        ...(content ? [content] : []),
        { type: "html", value: marker.after },
      ];
    },
  });
  const marker = new RegExp(`${prefix}(\\d+)(s|e)\uE001`, "g");
  let clean = "";
  let previous = 0;
  for (const match of marked.matchAll(marker)) {
    clean += marked.slice(previous, match.index);
    const span = spans[Number(match[1])]!;
    if (match[2] === "s") span.start = clean.length;
    else span.end = clean.length;
    previous = match.index + match[0].length;
  }
  clean += marked.slice(previous);
  for (const span of spans) {
    if (span.kind !== "block") continue;
    const content = clean.slice(span.start, span.end);
    span.start += content.length - content.trimStart().length;
    span.end = Math.max(span.start, span.end - (content.length - content.trimEnd().length));
  }
  return { clean, spans };
};

/** Export annotations live only in a temporary AST; the Lexical state never changes. */
export const createMarkdownSourcePoints = (root: ElementNode, source: string) => {
  const canonical = exportLexicalToMarkdown(root);
  const marked = markedSourceSpans(root, canonical);
  const canonicalMap = buildSourceMap(marked.clean, canonical);
  const sourceMap = buildSourceMap(canonical, source);
  const byKey = new Map<string, number[]>();
  const points: Array<{ source: number; point: SourcePoint }> = [];
  const record = (point: SourcePoint, offset: number, replace = false) => {
    const offsets = byKey.get(point.key) ?? [];
    if (!replace && offsets[point.offset] !== undefined) return;
    offsets[point.offset] = offset;
    byKey.set(point.key, offsets);
  };
  const sourceOffset = (position: number) => mappedInsertion(sourceMap, mappedInsertion(canonicalMap, position));
  const recordBounds = (span: SourceSpan, start: number, end: number) => {
    const node = span.node;
    const parent = node.getParent();
    if (parent) {
      const offset = node.getIndexWithinParent();
      record({ key: parent.getKey(), offset, type: "element" }, start, true);
      record({ key: parent.getKey(), offset: offset + 1, type: "element" }, end);
    }
    if (!$isElementNode(node)) return;
    if (node.getType() === "code" && node.isEmpty()) {
      const newline = source.indexOf("\n", start);
      record(
        { key: node.getKey(), offset: 0, type: "element" },
        newline >= start && newline < end ? newline + 1 : start,
      );
      return;
    }
    record({ key: node.getKey(), offset: 0, type: "element" }, start);
    record({ key: node.getKey(), offset: node.getChildrenSize(), type: "element" }, end);
  };
  for (const span of marked.spans) {
    if (span.start < 0 || span.end < span.start) continue;
    if (span.kind !== "text") {
      recordBounds(span, sourceOffset(span.start), sourceOffset(span.end));
      continue;
    }
    const local = buildSourceMap(span.node.getTextContent(), marked.clean.slice(span.start, span.end));
    for (let offset = 0; offset <= span.node.getTextContentSize(); offset++) {
      record(
        { key: span.node.getKey(), offset, type: "text" },
        sourceOffset(span.start + mappedInsertion(local, offset)),
      );
    }
    recordBounds(span, sourceOffset(span.start), sourceOffset(span.end));
  }
  for (const [key, offsets] of byKey) {
    const type = $isTextNode($getNodeByKey(key)) ? "text" : "element";
    offsets.forEach((source, offset) => {
      points.push({ source, point: { key, offset, type } });
    });
  }
  points.sort(
    (left, right) =>
      left.source - right.source || Number(left.point.type === "element") - Number(right.point.type === "element"),
  );
  return {
    toSource(point: SourcePoint) {
      const offsets = byKey.get(point.key);
      const offset = offsets?.[point.offset];
      if (offset !== undefined) return offset;
      return elementSource(point, byKey, source.length);
    },
    toPoint(offset: number) {
      let left = 0;
      let right = points.length;
      while (left < right) {
        const middle = Math.floor((left + right) / 2);
        if (points[middle]!.source < offset) left = middle + 1;
        else right = middle;
      }
      return (
        points[left]?.point ??
        points.at(-1)?.point ?? {
          key: root.getFirstChild()?.getKey() ?? root.getKey(),
          offset: 0,
          type: "element" as const,
        }
      );
    },
  };
};
