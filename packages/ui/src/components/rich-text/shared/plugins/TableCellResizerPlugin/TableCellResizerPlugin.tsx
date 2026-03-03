import "./TableCellResizerPlugin.css";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import type { TableDOMCell } from "@lexical/table";
import {
  $getTableColumnIndexFromTableCellNode,
  $getTableNodeFromLexicalNodeOrThrow,
  $getTableRowIndexFromTableCellNode,
  $isTableCellNode,
  $isTableRowNode,
  $isTableSelection,
  getDOMCellFromTarget,
  type TableCellNode,
} from "@lexical/table";
import type { LexicalEditor } from "lexical";
import { $getNearestNodeFromDOMNode, $getSelection, COMMAND_PRIORITY_HIGH, SELECTION_CHANGE_COMMAND } from "lexical";
import { type MouseEventHandler, type ReactNode, type ReactPortal, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type MousePosition = {
  x: number;
  y: number;
};

type MouseDraggingDirection = "right" | "bottom";

const MIN_ROW_HEIGHT = 33;
const MIN_COLUMN_WIDTH = 50;

const isHeightChanging = (direction: MouseDraggingDirection) => direction === "bottom";

function applyRowHeight(editor: LexicalEditor, activeCell: TableDOMCell, newHeight: number) {
  editor.update(() => {
    const tableCellNode = $getNearestNodeFromDOMNode(activeCell.elem);
    if (!$isTableCellNode(tableCellNode)) {
      throw new Error("TableCellResizer: Table cell node not found.");
    }

    const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
    const tableRowIndex = $getTableRowIndexFromTableCellNode(tableCellNode);
    const tableRows = tableNode.getChildren();

    if (tableRowIndex >= tableRows.length || tableRowIndex < 0) {
      throw new Error("Expected table cell to be inside of table row.");
    }

    const tableRow = tableRows[tableRowIndex];
    if (!$isTableRowNode(tableRow)) {
      throw new Error("Expected table row");
    }

    tableRow.setHeight(newHeight);
  });
}

function applyColumnWidth(editor: LexicalEditor, activeCell: TableDOMCell, newWidth: number) {
  editor.update(() => {
    const tableCellNode = $getNearestNodeFromDOMNode(activeCell.elem);
    if (!$isTableCellNode(tableCellNode)) {
      throw new Error("TableCellResizer: Table cell node not found.");
    }

    const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
    const tableColumnIndex = $getTableColumnIndexFromTableCellNode(tableCellNode);
    const tableRows = tableNode.getChildren();

    for (let r = 0; r < tableRows.length; r++) {
      const tableRow = tableRows[r];
      if (!$isTableRowNode(tableRow)) {
        throw new Error("Expected table row");
      }

      const rowCells = tableRow.getChildren<TableCellNode>();
      const rowCellsSpan = rowCells.map((cell) => cell.getColSpan());

      const aggregatedRowSpans = rowCellsSpan.reduce((rowSpans: number[], cellSpan) => {
        const previousCell = rowSpans[rowSpans.length - 1] ?? 0;
        rowSpans.push(previousCell + cellSpan);
        return rowSpans;
      }, []);
      const rowColumnIndexWithSpan = aggregatedRowSpans.findIndex((cellSpan: number) => cellSpan > tableColumnIndex);

      if (rowColumnIndexWithSpan >= rowCells.length || rowColumnIndexWithSpan < 0) {
        throw new Error("Expected table cell to be inside of table row.");
      }

      const tableCell = rowCells[rowColumnIndexWithSpan];
      if (!$isTableCellNode(tableCell)) {
        throw new Error("Expected table cell");
      }

      tableCell.setWidth(newWidth);
    }
  });
}

const getNextRowHeight = (activeCell: TableDOMCell, startY: number, clientY: number) => {
  const height = activeCell.elem.getBoundingClientRect().height;
  const heightChange = Math.abs(clientY - startY);
  const isShrinking = startY > clientY;
  return Math.max(isShrinking ? height - heightChange : height + heightChange, MIN_ROW_HEIGHT);
};

const getNextColumnWidth = (activeCell: TableDOMCell, startX: number, clientX: number) => {
  const computedStyle = getComputedStyle(activeCell.elem);
  let width = activeCell.elem.clientWidth;
  width -= parseFloat(computedStyle.paddingLeft) + parseFloat(computedStyle.paddingRight);
  const widthChange = Math.abs(clientX - startX);
  const isShrinking = startX > clientX;
  return Math.max(isShrinking ? width - widthChange : width + widthChange, MIN_COLUMN_WIDTH);
};

function TableCellResizer({ editor }: { editor: LexicalEditor }): ReactNode {
  const targetRef = useRef<HTMLElement | null>(null);
  const resizerRef = useRef<HTMLDivElement | null>(null);
  const tableRectRef = useRef<ClientRect | null>(null);

  const mouseStartPosRef = useRef<MousePosition | null>(null);
  const [mouseCurrentPos, updateMouseCurrentPos] = useState<MousePosition | null>(null);

  const [activeCell, updateActiveCell] = useState<TableDOMCell | null>(null);
  const [isSelectingGrid, updateIsSelectingGrid] = useState<boolean>(false);
  const [draggingDirection, updateDraggingDirection] = useState<MouseDraggingDirection | null>(null);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        const selection = $getSelection();
        const isTableSelection = $isTableSelection(selection);

        if (isSelectingGrid !== isTableSelection) {
          updateIsSelectingGrid(isTableSelection);
        }

        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );
  });

  const clearResizeState = () => {
    updateActiveCell(null);
    targetRef.current = null;
    updateDraggingDirection(null);
    mouseStartPosRef.current = null;
    tableRectRef.current = null;
  };

  // Store in ref so the effect closure always calls the latest version
  const clearResizeStateRef = useRef(clearResizeState);
  clearResizeStateRef.current = clearResizeState;

  const syncActiveCellFromTargetRef = useRef<(target: EventTarget | null) => void>(() => {});
  syncActiveCellFromTargetRef.current = (target: EventTarget | null) => {
    if (targetRef.current === target) return;

    targetRef.current = target as HTMLElement;
    const cell = getDOMCellFromTarget(target as HTMLElement);
    if (!cell) {
      clearResizeStateRef.current();
      return;
    }

    if (activeCell === cell) return;

    editor.update(() => {
      const tableCellNode = $getNearestNodeFromDOMNode(cell.elem);
      if (!tableCellNode) throw new Error("TableCellResizer: Table cell node not found.");

      const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
      const tableElement = editor.getElementByKey(tableNode.getKey());
      if (!tableElement) throw new Error("TableCellResizer: Table element not found.");

      targetRef.current = target as HTMLElement;
      tableRectRef.current = tableElement.getBoundingClientRect();
      updateActiveCell(cell);
    });
  };

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      setTimeout(() => {
        if (draggingDirection) {
          updateMouseCurrentPos({ x: event.clientX, y: event.clientY });
          return;
        }

        const target = event.target;
        if (resizerRef.current?.contains(target as Node)) return;
        syncActiveCellFromTargetRef.current(target);
      }, 0);
    };

    document.addEventListener("mousemove", onMouseMove);
    return () => document.removeEventListener("mousemove", onMouseMove);
  }, [draggingDirection]);

  const mouseUpHandler = (direction: MouseDraggingDirection) => {
    const handler = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (!activeCell) throw new Error("TableCellResizer: Expected active cell.");

      if (mouseStartPosRef.current) {
        const { x, y } = mouseStartPosRef.current;

        if (isHeightChanging(direction)) {
          applyRowHeight(editor, activeCell, getNextRowHeight(activeCell, y, event.clientY));
        } else {
          applyColumnWidth(editor, activeCell, getNextColumnWidth(activeCell, x, event.clientX));
        }

        clearResizeState();
        document.removeEventListener("mouseup", handler);
      }
    };
    return handler;
  };

  const toggleResize =
    (direction: MouseDraggingDirection): MouseEventHandler<HTMLButtonElement> =>
    (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (!activeCell) throw new Error("TableCellResizer: Expected active cell.");

      mouseStartPosRef.current = { x: event.clientX, y: event.clientY };
      updateMouseCurrentPos(mouseStartPosRef.current);
      updateDraggingDirection(direction);
      document.addEventListener("mouseup", mouseUpHandler(direction));
    };

  const resizerStyles = getResizerStyles(activeCell, draggingDirection, mouseCurrentPos, tableRectRef.current);

  return (
    <div ref={resizerRef}>
      {activeCell != null && !isSelectingGrid && (
        <>
          <button
            type="button"
            className="TableCellResizer__resizer TableCellResizer__ui"
            style={resizerStyles.right || undefined}
            onMouseDown={toggleResize("right")}
            aria-label="Resize column"
          />
          <button
            type="button"
            className="TableCellResizer__resizer TableCellResizer__ui"
            style={resizerStyles.bottom || undefined}
            onMouseDown={toggleResize("bottom")}
            aria-label="Resize row"
          />
        </>
      )}
    </div>
  );
}

function getResizerStyles(
  activeCell: TableDOMCell | null,
  draggingDirection: MouseDraggingDirection | null,
  mouseCurrentPos: MousePosition | null,
  tableRect: ClientRect | null,
) {
  if (!activeCell) return { bottom: null, left: null, right: null, top: null };

  const { height, width, top, left } = activeCell.elem.getBoundingClientRect();

  const styles = {
    bottom: {
      backgroundColor: "none",
      cursor: "row-resize",
      height: "10px",
      left: `${window.pageXOffset + left}px`,
      top: `${window.pageYOffset + top + height}px`,
      width: `${width}px`,
    },
    right: {
      backgroundColor: "none",
      cursor: "col-resize",
      height: `${height}px`,
      left: `${window.pageXOffset + left + width}px`,
      top: `${window.pageYOffset + top}px`,
      width: "10px",
    },
  };

  if (draggingDirection && mouseCurrentPos && tableRect) {
    if (isHeightChanging(draggingDirection)) {
      styles[draggingDirection].left = `${window.pageXOffset + tableRect.left}px`;
      styles[draggingDirection].top = `${window.pageYOffset + mouseCurrentPos.y}px`;
      styles[draggingDirection].height = "3px";
      styles[draggingDirection].width = `${tableRect.width}px`;
    } else {
      styles[draggingDirection].top = `${window.pageYOffset + tableRect.top}px`;
      styles[draggingDirection].left = `${window.pageXOffset + mouseCurrentPos.x}px`;
      styles[draggingDirection].width = "3px";
      styles[draggingDirection].height = `${tableRect.height}px`;
    }
    styles[draggingDirection].backgroundColor = "#adf";
  }

  return styles;
}

export default function TableCellResizerPlugin(): null | ReactPortal {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();

  return isEditable ? createPortal(<TableCellResizer editor={editor} />, document.body) : null;
}
