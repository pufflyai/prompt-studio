import { $createAutoLinkNode, $isAutoLinkNode, AutoLinkNode } from "@lexical/link";
import type { ElementTransformer, TextMatchTransformer } from "@lexical/markdown";
import { $createTextNode, TextNode } from "lexical";
import { $createDataTableNode, $isDataTableNode, type RowData } from "../nodes/DataTableNode";
import { HR } from "../plugins/HorizontalRulePlugin/horizontalRule";

export const TABLE: ElementTransformer = {
  dependencies: [],
  export: (node, _traverseChildren) => {
    if ($isDataTableNode(node)) {
      const data = node.getData();

      if (!data.length) return "";

      const headers = Object.keys(data[0]);
      const headerRow = headers.join(" | ");
      const separator = headers.map(() => "---").join(" | ");
      const dataRows = data.map((row) => headers.map((header) => String(row[header] || "")).join(" | "));

      return [`| ${headerRow} |`, `| ${separator} |`, ...dataRows.map((row) => `| ${row} |`)].join("\n");
    }

    return null;
  },
  regExp: /^\s*(\|.+\|)\s*$/,
  replace: (parentNode, _children, match, _isImport) => {
    const previousNode = parentNode.getPreviousSibling();
    const isTableDelimiter = /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?$/gm.test(match[0]);

    // if it is a delimiter, remove it
    if (isTableDelimiter) {
      parentNode.remove();
      return;
    }

    // Parse current row
    const cells = match[0]
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (previousNode?.getType() === "data_table" && $isDataTableNode(previousNode)) {
      // Add row to existing table
      const existingData = previousNode.getData();
      const newRow: RowData = {};

      // Check if we have a placeholder row with empty values (created from headers)
      const isPlaceholderRow =
        existingData.length === 1 && Object.values(existingData[0]).every((value) => value === "");

      // Get headers from existing data structure
      const headers = existingData.length > 0 ? Object.keys(existingData[0]) : cells.map((_, index) => `col_${index}`);

      cells.forEach((cell, index) => {
        const header = headers[index] || `col_${index}`;
        newRow[header] = cell;
      });

      // If we had a placeholder row, replace it; otherwise append
      const newTableData = isPlaceholderRow ? [newRow] : [...existingData, newRow];
      const newTableNode = $createDataTableNode(newTableData);
      previousNode.replace(newTableNode);
      parentNode.remove();
    } else {
      // Create new table - treat first row as headers
      // Create a temporary empty row with these headers, which will be replaced when actual data comes
      const newRow: RowData = {};
      cells.forEach((cell, index) => {
        newRow[cell || `col_${index}`] = "";
      });

      const tableNode = $createDataTableNode([newRow]);
      parentNode.replace(tableNode);
    }
  },
  type: "element",
};

export const UNDERLINE_INS_TAG: TextMatchTransformer = {
  dependencies: [TextNode],
  export: (node, _children) => {
    if (node instanceof TextNode) {
      let markdownText = node.getTextContent();

      if (node.hasFormat("bold")) {
        markdownText = `**${markdownText}**`;
      } else if (node.hasFormat("italic")) {
        markdownText = `*${markdownText}*`;
      } else if (node.hasFormat("underline")) {
        markdownText = `<ins>${markdownText}</ins>`;
      } else {
        return null;
      }

      return markdownText;
    }
    return null;
  },
  regExp: /<ins>(.*)<\/ins>/,
  importRegExp: /<ins>(.*)<\/ins>/,
  replace: (node, match) => {
    const textNode = $createTextNode(match[1]);
    textNode.toggleFormat("underline");
    node.replace(textNode);
  },
  type: "text-match",
};

export const UNDERLINE_U_TAG: TextMatchTransformer = {
  dependencies: [TextNode],
  export: (_node, _children) => {
    return null;
  },
  regExp: /<u>(.*)<\/u>/,
  importRegExp: /<u>(.*)<\/u>/,
  replace: (node, match) => {
    const textNode = $createTextNode(match[1]);
    textNode.toggleFormat("underline");
    node.replace(textNode);
  },
  type: "text-match",
};

const BARE_URL_REGEXP = /https?:\/\/[^\s<>"']*[^\s<>"'.,:;"')\]}]/;

export const BARE_URL: TextMatchTransformer = {
  dependencies: [AutoLinkNode],
  export: (node, exportChildren) => {
    if (!$isAutoLinkNode(node)) {
      return null;
    }

    return exportChildren(node);
  },
  regExp: BARE_URL_REGEXP,
  importRegExp: BARE_URL_REGEXP,
  replace: (textNode, match) => {
    const href = match[0];
    const autoLinkNode = $createAutoLinkNode(href);
    const linkTextNode = $createTextNode(href);

    linkTextNode.setFormat(textNode.getFormat());
    autoLinkNode.append(linkTextNode);
    textNode.replace(autoLinkNode);
  },
  type: "text-match",
};

export const TRANSFORMERS_EXTENDED = [TABLE, HR, UNDERLINE_INS_TAG, UNDERLINE_U_TAG, BARE_URL];
