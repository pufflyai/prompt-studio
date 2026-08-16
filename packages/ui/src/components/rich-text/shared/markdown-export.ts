import { $isLinkNode } from "@lexical/link";
import { $isListItemNode, $isListNode, type ListItemNode, type ListNode } from "@lexical/list";
import { $isHeadingNode, $isQuoteNode } from "@lexical/rich-text";
import {
  $isElementNode,
  $isLineBreakNode,
  $isParagraphNode,
  $isTextNode,
  type ElementNode,
  type LexicalNode,
  type TextNode,
} from "lexical";
import type { BlockContent, ListItem, Paragraph, PhrasingContent, Root, Table, TableCell } from "mdast";
import { $isReferenceLinkNode } from "../markdown-editor/plugins/ReferenceLinkPlugin/ReferenceLinkNode";
import { $isCodeNode } from "./lexical-code";
import { parseMarkdownInline, serializeMarkdownAst } from "./markdown-ast";
import { $isDataTableNode, type DataTableNode } from "./nodes/DataTableNode";
import { $isMarkdownImageNode } from "./nodes/MarkdownImageNode";
import { $isMarkdownLinkNode } from "./nodes/MarkdownLinkNode";
import { $isRawHtmlNode } from "./nodes/RawHtmlNode";
import { $isEquationNode } from "./plugins/EquationPlugin/EquationNode";
import { $isHRNode } from "./plugins/HorizontalRulePlugin/HorizontalRuleNode";
import { $isMermaidNode } from "./plugins/MermaidPlugin/MermaidNode";

const exportText = (node: TextNode) => {
  let content: PhrasingContent = node.hasFormat("code")
    ? { type: "inlineCode", value: node.getTextContent() }
    : { type: "text", value: node.getTextContent() };

  if (!node.hasFormat("code")) {
    if (node.hasFormat("bold")) content = { type: "strong", children: [content] };
    if (node.hasFormat("italic")) content = { type: "emphasis", children: [content] };
    if (node.hasFormat("strikethrough")) content = { type: "delete", children: [content] };
  }

  if (node.hasFormat("underline")) {
    return [
      { type: "html", value: "<ins>" } as PhrasingContent,
      content,
      { type: "html", value: "</ins>" } as PhrasingContent,
    ];
  }

  return [content];
};

const exportInlineNode = (node: LexicalNode): PhrasingContent[] => {
  if ($isTextNode(node)) return exportText(node);
  if ($isLineBreakNode(node)) return [{ type: "break" }];
  if ($isMarkdownImageNode(node)) {
    return [{ type: "image", url: node.getSource(), alt: node.getAlt(), title: node.getTitle() }];
  }
  if ($isEquationNode(node) && node.isInline()) return [{ type: "inlineMath", value: node.getEquation() }];
  if ($isRawHtmlNode(node)) return [{ type: "html", value: node.getSource() }];
  if ($isReferenceLinkNode(node)) return [{ type: "text", value: node.getTextContent() }];

  if ($isLinkNode(node)) {
    return [
      {
        type: "link",
        url: $isMarkdownLinkNode(node) ? node.getSource() : node.getURL(),
        title: node.getTitle(),
        children: exportInlineChildren(node),
      },
    ];
  }

  if ($isElementNode(node)) return exportInlineChildren(node);
  const value = node.getTextContent();
  return value ? [{ type: "text", value }] : [];
};

const exportInlineChildren = (node: ElementNode) => node.getChildren().flatMap(exportInlineNode);

const paragraphFrom = (node: ElementNode): Paragraph => ({
  type: "paragraph",
  children: exportInlineChildren(node),
});

const exportListItem = (node: ListItemNode): ListItem => {
  const children: BlockContent[] = [];
  const inline: PhrasingContent[] = [];

  for (const child of node.getChildren()) {
    if ($isListNode(child)) {
      if (inline.length) children.push({ type: "paragraph", children: inline.splice(0) });
      children.push(exportList(child));
    } else if ($isParagraphNode(child)) {
      if (inline.length) children.push({ type: "paragraph", children: inline.splice(0) });
      children.push(paragraphFrom(child));
    } else {
      inline.push(...exportInlineNode(child));
    }
  }

  if (inline.length || children.length === 0) children.unshift({ type: "paragraph", children: inline });

  return {
    type: "listItem",
    checked: node.getChecked(),
    spread: false,
    children,
  };
};

const exportList = (node: ListNode) => ({
  type: "list" as const,
  ordered: node.getListType() === "number",
  start: node.getListType() === "number" ? node.getStart() : null,
  spread: false,
  children: node.getChildren().filter($isListItemNode).map(exportListItem),
});

const tableCell = (value: string): TableCell => ({
  type: "tableCell",
  children: parseMarkdownInline(value),
});

const exportTable = (node: DataTableNode): Table => {
  const table = node.getTable();
  return {
    type: "table",
    align: table.columns.map((column) => column.alignment),
    children: [
      {
        type: "tableRow",
        children: table.columns.map((column) => tableCell(column.label)),
      },
      ...table.rows.map((row) => ({
        type: "tableRow" as const,
        children: table.columns.map((column) => tableCell(row.cells[column.id] ?? "")),
      })),
    ],
  };
};

const exportBlock = (node: LexicalNode): BlockContent | null => {
  if ($isParagraphNode(node)) return paragraphFrom(node);
  if ($isHeadingNode(node)) {
    return {
      type: "heading",
      depth: Number(node.getTag().slice(1)) as 1 | 2 | 3 | 4 | 5 | 6,
      children: exportInlineChildren(node),
    };
  }
  if ($isQuoteNode(node)) {
    return {
      type: "blockquote",
      children: node
        .getChildren()
        .map(exportBlock)
        .filter((child) => child !== null),
    };
  }
  if ($isListNode(node)) return exportList(node);
  if ($isCodeNode(node)) {
    return { type: "code", lang: node.getLanguage() || null, meta: null, value: node.getTextContent() };
  }
  if ($isMermaidNode(node)) return { type: "code", lang: "mermaid", meta: null, value: node.getCode() };
  if ($isEquationNode(node)) return { type: "math", meta: null, value: node.getEquation() };
  if ($isHRNode(node)) return { type: "thematicBreak" };
  if ($isDataTableNode(node)) return exportTable(node);
  if ($isRawHtmlNode(node)) return { type: "html", value: node.getSource() };
  if ($isElementNode(node)) return paragraphFrom(node);

  const value = node.getTextContent();
  return value ? { type: "paragraph", children: [{ type: "text", value }] } : null;
};

export const exportLexicalToMarkdown = (root: ElementNode) => {
  const tree: Root = {
    type: "root",
    children: root
      .getChildren()
      .map(exportBlock)
      .filter((node) => node !== null),
  };
  return serializeMarkdownAst(tree);
};
