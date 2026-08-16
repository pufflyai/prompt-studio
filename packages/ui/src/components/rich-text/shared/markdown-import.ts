import { $createListItemNode, $createListNode } from "@lexical/list";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  type ElementNode,
  type LexicalNode,
  type TextFormatType,
} from "lexical";
import type { Definition, ImageReference, LinkReference, PhrasingContent, RootContent, Table } from "mdast";
import { $createReferenceLinkNode } from "../markdown-editor/plugins/ReferenceLinkPlugin/ReferenceLinkNode";
import { $createCodeNode } from "./lexical-code";
import { parseMarkdown, serializeMarkdownBlock, serializeMarkdownInline } from "./markdown-ast";
import type { MarkdownTableAlignment, MarkdownTableValue } from "./markdown-table";
import type { MarkdownUrlResolver } from "./markdown-url";
import { $createDataTableNode } from "./nodes/DataTableNode";
import { $createMarkdownImageNode } from "./nodes/MarkdownImageNode";
import { $createMarkdownLinkNode } from "./nodes/MarkdownLinkNode";
import { $createRawHtmlNode } from "./nodes/RawHtmlNode";
import { $createEquationNode } from "./plugins/EquationPlugin/EquationNode";
import { $createHRNode } from "./plugins/HorizontalRulePlugin/HorizontalRuleNode";
import { $createMermaidNode } from "./plugins/MermaidPlugin/MermaidNode";

interface ImportContext {
  definitions: Map<string, Definition>;
  resolver?: MarkdownUrlResolver;
  tableIndex: number;
}

const REFERENCE_TOKEN = /\{\{\s*link\((['"])([^'"\s]+)\1\)\s*\}\}/g;

const formattedText = (value: string, formats: Set<TextFormatType>) => {
  const node = $createTextNode(value);
  for (const format of formats) node.toggleFormat(format);
  return node;
};

const textWithReferences = (value: string, formats: Set<TextFormatType>) => {
  const nodes: LexicalNode[] = [];
  let start = 0;

  for (const match of value.matchAll(REFERENCE_TOKEN)) {
    const index = match.index ?? 0;
    if (index > start) nodes.push(formattedText(value.slice(start, index), formats));
    const label = match[2] ?? "";
    const href = /^(?:https?:\/\/|\/)/i.test(label) ? label : `#${label}`;
    nodes.push($createReferenceLinkNode(href, label));
    start = index + match[0].length;
  }

  if (start < value.length) nodes.push(formattedText(value.slice(start), formats));
  return nodes;
};

const referenceDefinition = (node: LinkReference | ImageReference, context: ImportContext) =>
  context.definitions.get(node.identifier.toLowerCase());

function importInlineNode(node: PhrasingContent, context: ImportContext, formats: Set<TextFormatType>) {
  switch (node.type) {
    case "text":
      return textWithReferences(node.value, formats);
    case "strong":
      return importInlineChildren(node.children, context, new Set([...formats, "bold"]));
    case "emphasis":
      return importInlineChildren(node.children, context, new Set([...formats, "italic"]));
    case "delete":
      return importInlineChildren(node.children, context, new Set([...formats, "strikethrough"]));
    case "inlineCode":
      return [formattedText(node.value, new Set([...formats, "code"]))];
    case "break":
      return [$createLineBreakNode()];
    case "link": {
      const link = $createMarkdownLinkNode(node.url, context.resolver, { title: node.title });
      link.append(...importInlineChildren(node.children, context, formats));
      return [link];
    }
    case "linkReference": {
      const definition = referenceDefinition(node, context);
      if (!definition) return [formattedText(serializeMarkdownInline([node]), formats)];
      const link = $createMarkdownLinkNode(definition.url, context.resolver, { title: definition.title });
      link.append(...importInlineChildren(node.children, context, formats));
      return [link];
    }
    case "image":
      return [$createMarkdownImageNode(node.url, node.alt ?? "", node.title ?? null)];
    case "imageReference": {
      const definition = referenceDefinition(node, context);
      if (!definition) return [formattedText(serializeMarkdownInline([node]), formats)];
      return [$createMarkdownImageNode(definition.url, node.alt ?? "", definition.title ?? null)];
    }
    case "inlineMath":
      return [$createEquationNode(node.value, true)];
    case "html":
      return [$createRawHtmlNode(node.value, "inline")];
    default:
      return [formattedText(serializeMarkdownInline([node]), formats)];
  }
}

function importInlineChildren(
  children: PhrasingContent[],
  context: ImportContext,
  formats = new Set<TextFormatType>(),
) {
  const nodes: LexicalNode[] = [];
  let underlineDepth = 0;

  for (const node of children) {
    if (node.type === "html" && /^<(?:ins|u)>$/i.test(node.value.trim())) {
      underlineDepth += 1;
      continue;
    }
    if (node.type === "html" && /^<\/(?:ins|u)>$/i.test(node.value.trim())) {
      underlineDepth = Math.max(underlineDepth - 1, 0);
      continue;
    }

    const activeFormats = new Set(formats);
    if (underlineDepth > 0) activeFormats.add("underline");
    nodes.push(...importInlineNode(node, context, activeFormats));
  }

  return nodes;
}

const tableValue = (table: Table, context: ImportContext): MarkdownTableValue => {
  context.tableIndex += 1;
  const prefix = `table-${context.tableIndex}`;
  const header = table.children[0];
  const columnCount = Math.max(header?.children.length ?? 0, 1);
  const columns = Array.from({ length: columnCount }, (_, index) => ({
    id: `${prefix}-column-${index + 1}`,
    label: header?.children[index] ? serializeMarkdownInline(header.children[index].children) : "",
    alignment: (table.align?.[index] ?? null) as MarkdownTableAlignment,
  }));
  const rows = table.children.slice(1).map((row, rowIndex) => ({
    id: `${prefix}-row-${rowIndex + 1}`,
    cells: Object.fromEntries(
      columns.map((column, columnIndex) => [
        column.id,
        row.children[columnIndex] ? serializeMarkdownInline(row.children[columnIndex].children) : "",
      ]),
    ),
  }));

  return { columns, rows };
};

const appendListItem = (parent: ElementNode, node: RootContent, context: ImportContext) => {
  if (node.type !== "listItem") return;
  const item = $createListItemNode(node.checked ?? undefined);
  parent.append(item);

  for (const child of node.children) {
    if (child.type === "paragraph") item.append(...importInlineChildren(child.children, context));
    else if (child.type === "list") appendBlock(item, child, context);
    else item.append(formattedText(serializeMarkdownBlock(child), new Set()));
  }
};

const appendBlock = (parent: ElementNode, node: RootContent, context: ImportContext) => {
  switch (node.type) {
    case "paragraph": {
      const paragraph = $createParagraphNode();
      paragraph.append(...importInlineChildren(node.children, context));
      parent.append(paragraph);
      break;
    }
    case "heading": {
      const heading = $createHeadingNode(`h${node.depth}`);
      heading.append(...importInlineChildren(node.children, context));
      parent.append(heading);
      break;
    }
    case "blockquote": {
      const quote = $createQuoteNode();
      parent.append(quote);
      for (const child of node.children) appendBlock(quote, child, context);
      break;
    }
    case "list": {
      const hasTasks = node.children.some((item) => item.checked !== null && item.checked !== undefined);
      let listType: "bullet" | "check" | "number" = "bullet";
      if (node.ordered) listType = "number";
      else if (hasTasks) listType = "check";
      const list = $createListNode(listType, node.start ?? 1);
      parent.append(list);
      for (const item of node.children) appendListItem(list, item, context);
      break;
    }
    case "code":
      parent.append(
        node.lang === "mermaid"
          ? $createMermaidNode(node.value)
          : $createCodeNode(node.lang ?? undefined).append($createTextNode(node.value)),
      );
      break;
    case "math":
      parent.append($createEquationNode(node.value, false));
      break;
    case "thematicBreak":
      parent.append($createHRNode());
      break;
    case "table":
      parent.append($createDataTableNode(tableValue(node, context)));
      break;
    case "html":
      parent.append($createRawHtmlNode(node.value, "block"));
      break;
    case "definition":
      break;
    default: {
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode(serializeMarkdownBlock(node)));
      parent.append(paragraph);
    }
  }
};

export const importMarkdownToLexical = (markdown: string, resolver?: MarkdownUrlResolver) => {
  const tree = parseMarkdown(markdown);
  const definitions = new Map(
    tree.children
      .filter((node): node is Definition => node.type === "definition")
      .map((node) => [node.identifier.toLowerCase(), node]),
  );
  const context: ImportContext = { definitions, resolver, tableIndex: 0 };
  const root = $getRoot();
  root.clear();

  for (const node of tree.children) appendBlock(root, node, context);
};
