import { Box } from "@chakra-ui/react";
import {
  $applyNodeReplacement,
  $createParagraphNode,
  $getNodeByKey,
  DecoratorNode,
  HISTORY_PUSH_TAG,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  REDO_COMMAND,
  type SerializedLexicalNode,
  type Spread,
  UNDO_COMMAND,
} from "lexical";
import type React from "react";
import { type FocusEvent, type KeyboardEvent, type MouseEvent, useRef, useState } from "react";
import { EditModeDataTable } from "@/components/data-table/edit-mode-data-table";
import type { DataTableEditModeColumn, RowData } from "@/components/data-table/types";
import { MarkdownEditor } from "../../markdown-editor/markdown-editor";
import { MarkdownInline } from "../markdown-inline";
import type { MarkdownTableValue } from "../markdown-table";

interface MarkdownDataTableProps {
  editor: LexicalEditor;
  nodeKey: NodeKey;
  table: MarkdownTableValue;
}

const projectRows = (table: MarkdownTableValue): RowData[] => table.rows.map((row) => ({ id: row.id, ...row.cells }));

const projectColumns = (table: MarkdownTableValue): DataTableEditModeColumn[] => table.columns;

const MarkdownDataTable = (props: MarkdownDataTableProps) => {
  const { editor, nodeKey, table } = props;
  const [isSelected, setSelected] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const focusTable = () => {
    setTimeout(() => containerRef.current?.focus(), 0);
  };

  const updateTable = (change: (current: MarkdownTableValue) => MarkdownTableValue) => {
    editor.update(
      () => {
        const node = $getNodeByKey(nodeKey);
        if ($isDataTableNode(node)) node.setTable(change(node.getTable()));
      },
      { tag: HISTORY_PUSH_TAG },
    );
    focusTable();
  };

  const handleColumnsChange = (columns: DataTableEditModeColumn[]) => {
    updateTable((current) => ({
      columns,
      rows: current.rows.map((row) => ({
        ...row,
        cells: Object.fromEntries(columns.map((column) => [column.id, row.cells[column.id] ?? ""])),
      })),
    }));
  };

  const handleDataChange = (data: RowData[]) => {
    updateTable((current) => ({
      ...current,
      rows: data.map((row, index) => ({
        id: String(row.id ?? current.rows[index]?.id ?? `row-${index + 1}`),
        cells: Object.fromEntries(current.columns.map((column) => [column.id, String(row[column.id] ?? "")])),
      })),
    }));
  };

  const deleteTable = () => {
    editor.update(
      () => {
        const node = $getNodeByKey(nodeKey);
        if ($isDataTableNode(node)) {
          const paragraph = $createParagraphNode();
          node.replace(paragraph);
          paragraph.select();
        }
      },
      { tag: HISTORY_PUSH_TAG },
    );
    setTimeout(() => editor.focus(), 0);
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, input, textarea, [contenteditable='true'], [role='menuitem']")) return;

    event.preventDefault();
    containerRef.current?.focus();
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSelected(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const isTextInput = target.matches("input, textarea") || target.isContentEditable;
    const isUndo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z";

    if (isUndo && !isTextInput) {
      event.preventDefault();
      event.stopPropagation();
      editor.dispatchCommand(event.shiftKey ? REDO_COMMAND : UNDO_COMMAND, undefined);
      return;
    }

    if (isTextInput) return;

    if (isSelected && (event.key === "Delete" || event.key === "Backspace")) {
      event.preventDefault();
      event.stopPropagation();
      deleteTable();
    }
  };

  return (
    <Box
      ref={containerRef}
      data-testid="markdown-table-node"
      data-selected={String(isSelected)}
      aria-label="Markdown table"
      aria-selected={isSelected}
      tabIndex={0}
      outline={isSelected ? "2px solid" : "none"}
      outlineColor="border.accent-light"
      outlineOffset="2px"
      borderRadius="sm"
      onFocus={() => setSelected(true)}
      onBlur={handleBlur}
      onClick={handleClick}
      onKeyDownCapture={handleKeyDown}
    >
      <EditModeDataTable
        data={projectRows(table)}
        editMode={{
          columns: projectColumns(table),
          onColumnsChange: handleColumnsChange,
          onDataChange: handleDataChange,
          renderHeader: (column) => <MarkdownInline value={column.label} />,
          renderCell: (context) => <MarkdownInline value={String(context.value ?? "")} />,
          renderCellEditor: ({ value, onChange }) => (
            <MarkdownEditor
              autoFocus
              defaultState={value}
              fullWidth
              isEditable
              padding="xs"
              scrollable={false}
              onChange={onChange}
            />
          ),
        }}
        fullWidth
        getRowId={(row) => String(row.id)}
        initialPageSize={30}
        isReadOnly={!editor.isEditable()}
      />
    </Box>
  );
};

export class DataTableNode extends DecoratorNode<React.JSX.Element> {
  __table: MarkdownTableValue;

  static getType() {
    return "data_table";
  }

  static clone(node: DataTableNode) {
    return new DataTableNode(node.__table, node.__key);
  }

  constructor(table: MarkdownTableValue, key?: NodeKey) {
    super(key);
    this.__table = table;
  }

  getTable() {
    return this.getLatest().__table;
  }

  setTable(table: MarkdownTableValue) {
    const writable = this.getWritable();
    writable.__table = table;
  }

  createDOM() {
    return document.createElement("div");
  }

  updateDOM() {
    return false;
  }

  decorate(editor: LexicalEditor) {
    return <MarkdownDataTable editor={editor} nodeKey={this.__key} table={this.__table} />;
  }

  exportJSON(): SerializedDataTableNode {
    return {
      type: "data_table",
      version: 2,
      table: this.__table,
    };
  }

  static importJSON(json: SerializedDataTableNode) {
    return $createDataTableNode(json.table);
  }

  getTextContent() {
    const headers = this.__table.columns.map((column) => column.label).join(" | ");
    const separator = this.__table.columns.map(() => "---").join(" | ");
    const rows = this.__table.rows.map((row) =>
      this.__table.columns.map((column) => row.cells[column.id] ?? "").join(" | "),
    );
    return [headers, separator, ...rows].join("\n");
  }
}

export type SerializedDataTableNode = Spread<
  { table: MarkdownTableValue; type: "data_table"; version: 2 },
  SerializedLexicalNode
>;

export const $createDataTableNode = (table: MarkdownTableValue) => $applyNodeReplacement(new DataTableNode(table));

export const $isDataTableNode = (node: LexicalNode | null | undefined): node is DataTableNode =>
  node instanceof DataTableNode;
