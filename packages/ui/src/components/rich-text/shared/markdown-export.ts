import { $isLinkNode } from "@lexical/link";
import { $isListItemNode, $isListNode, type ListItemNode, type ListNode } from "@lexical/list";
import { $isHeadingNode, $isQuoteNode } from "@lexical/rich-text";
import {
  $isElementNode,
  $isInlineElementOrDecoratorNode,
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

const inlineDecoration = (node: LexicalNode) => {
  if ($isMarkdownImageNode(node))
    return [{ type: "image" as const, url: node.getSource(), alt: node.getAlt(), title: node.getTitle() }];
  if ($isEquationNode(node) && node.isInline()) return [{ type: "inlineMath" as const, value: node.getEquation() }];
  if ($isRawHtmlNode(node)) return [{ type: "html" as const, value: node.getSource() }];
  if ($isReferenceLinkNode(node)) return [{ type: "text" as const, value: node.getTextContent() }];
  return null;
};

const codeContent = (node: ElementNode, transformText?: (node: TextNode) => string) =>
  node
    .getChildren()
    .map((child) => ($isTextNode(child) ? (transformText?.(child) ?? child.getTextContent()) : child.getTextContent()))
    .join("");

export interface MarkdownExportAnnotations {
  text?: (node: TextNode) => string;
  inline?: (node: LexicalNode, content: PhrasingContent[]) => PhrasingContent[];
  block?: (node: LexicalNode, content: BlockContent | null) => BlockContent[];
}

const createMarkdownExporter = (annotations?: MarkdownExportAnnotations) => {
  const transformText = annotations?.text;
  const exportText = (node: TextNode) => {
    const value = transformText?.(node) ?? node.getTextContent();
    let content: PhrasingContent = node.hasFormat("code") ? { type: "inlineCode", value } : { type: "text", value };

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

  const exportInlineContent = (node: LexicalNode): PhrasingContent[] => {
    if ($isTextNode(node)) return exportText(node);
    if ($isLineBreakNode(node)) return [{ type: "break" }];
    const decoration = inlineDecoration(node);
    if (decoration) return decoration;

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

  const exportInlineNode = (node: LexicalNode) => {
    const content = exportInlineContent(node);
    return $isTextNode(node) ? content : (annotations?.inline?.(node, content) ?? content);
  };

  const exportInlineChildren = (node: ElementNode) => node.getChildren().flatMap(exportInlineNode);

  const exportQuoteChildren = (node: ElementNode) => {
    const children: BlockContent[] = [];
    const inline: PhrasingContent[] = [];
    const flushInline = () => {
      if (inline.length) children.push({ type: "paragraph", children: inline.splice(0) });
    };

    for (const child of node.getChildren()) {
      if ($isTextNode(child) || $isLineBreakNode(child) || $isInlineElementOrDecoratorNode(child)) {
        inline.push(...exportInlineNode(child));
      } else {
        flushInline();
        const block = exportBlock(child);
        if (block) children.push(block);
      }
    }
    flushInline();
    return children;
  };

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

  const exportDecoration = (node: LexicalNode): BlockContent | null => {
    if ($isMermaidNode(node)) return { type: "code", lang: "mermaid", meta: null, value: node.getCode() };
    if ($isEquationNode(node)) return { type: "math", meta: null, value: node.getEquation() };
    if ($isHRNode(node)) return { type: "thematicBreak" };
    if ($isDataTableNode(node)) return exportTable(node);
    if ($isRawHtmlNode(node)) return { type: "html", value: node.getSource() };
    return null;
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
        children: exportQuoteChildren(node),
      };
    }
    if ($isListNode(node)) return exportList(node);
    if ($isCodeNode(node)) {
      return {
        type: "code",
        lang: node.getLanguage() || null,
        meta: null,
        value: codeContent(node, transformText),
      };
    }
    const decoration = exportDecoration(node);
    if (decoration) return decoration;
    if ($isElementNode(node)) return paragraphFrom(node);

    const value = node.getTextContent();
    return value ? { type: "paragraph", children: [{ type: "text", value }] } : null;
  };

  return { exportBlock };
};

export const exportLexicalBlockToMarkdown = (node: LexicalNode) => {
  const block = createMarkdownExporter().exportBlock(node);
  return serializeMarkdownAst({ type: "root", children: block ? [block] : [] });
};

export const exportLexicalToMarkdown = (root: ElementNode, annotations?: MarkdownExportAnnotations) => {
  const { exportBlock } = createMarkdownExporter(annotations);
  const tree: Root = {
    type: "root",
    children: root.getChildren().flatMap((node) => {
      const block = exportBlock(node);
      return annotations?.block?.(node, block) ?? (block ? [block] : []);
    }),
  };
  return serializeMarkdownAst(tree);
};
