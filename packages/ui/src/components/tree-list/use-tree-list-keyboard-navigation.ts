import { type KeyboardEvent, useContext, useEffect, useRef, useState } from "react";
import {
  getFocusableRows,
  getRowFocusId,
  isFocusableRow,
  resolveTreeListFocusRowId,
  resolveTreeListKeyboardNavigation,
  type VirtualRow,
} from "./tree-list-model";
import { TreeListSelectionContext } from "./tree-list-selection-context";

const findRowElement = (root: HTMLElement | null, focusId: string) => {
  if (!root) return null;
  const elements = root.querySelectorAll<HTMLElement>("[data-tree-list-focus-id]");
  return [...elements].find((element) => element.dataset.treeListFocusId === focusId) ?? null;
};

const findFocusedRowId = (root: HTMLElement | null, target: EventTarget | null) => {
  if (!root || !(target instanceof HTMLElement) || !root.contains(target)) return undefined;
  return target.closest<HTMLElement>("[data-tree-list-focus-id]")?.dataset.treeListFocusId;
};

const isTextEditingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
};

const getRowIndex = (rows: VirtualRow[], focusId: string) =>
  rows.findIndex((row) => isFocusableRow(row) && getRowFocusId(row) === focusId);

const isRangeNavigation = (event: KeyboardEvent<HTMLElement>) =>
  event.shiftKey &&
  !event.altKey &&
  !event.ctrlKey &&
  !event.metaKey &&
  (event.key === "ArrowUp" || event.key === "ArrowDown");

const adjacentNode = (rows: VirtualRow[], current: string | undefined, key: string) => {
  const ids = rows.flatMap((row) => (row.kind === "node" && !row.node.disabled ? [row.node.id] : []));
  return ids[ids.indexOf(current ?? "") + (key === "ArrowUp" ? -1 : 1)];
};

export const useTreeListKeyboardNavigation = (input: {
  rows: VirtualRow[];
  activeNodeId?: string | string[] | null;
  expandedNodeIds: string[];
  onToggleNode?: (nodeId: string) => void;
  onToggleSection?: (sectionId: string) => void;
  scrollToRow?: (index: number) => void;
}) => {
  const { rows, activeNodeId, expandedNodeIds, onToggleNode, onToggleSection, scrollToRow } = input;
  const selection = useContext(TreeListSelectionContext);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const focusedElement = useRef<HTMLElement | null>(null);
  const [focusedRowId, setFocusedRowId] = useState<string>();
  const [pendingFocusRowId, setPendingFocusRowId] = useState<string>();
  const focusRowId = resolveTreeListFocusRowId(focusedRowId, activeNodeId, rows);
  const focusableRows = JSON.stringify(
    getFocusableRows(rows).map((row) => ({
      id: getRowFocusId(row),
      section: row.sectionId,
      level: row.kind === "node" ? row.level : 0,
    })),
  );

  useEffect(() => {
    if (!focusedRowId) return;
    if (!(JSON.parse(focusableRows) as { id: string }[]).some((row) => row.id === focusedRowId)) {
      setFocusedRowId(undefined);
      return;
    }
    const previous = focusedElement.current;
    if (!previous || previous.isConnected) return;
    focusedElement.current = null;
    // Reparenting remounts a row. Restore its focus only when removal left focus on the document body.
    if (previous.ownerDocument.hasFocus() && previous.ownerDocument.activeElement === previous.ownerDocument.body)
      findRowElement(rootRef.current, focusedRowId)?.focus();
  }, [focusedRowId, focusableRows]);

  useEffect(() => {
    if (!pendingFocusRowId) return;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const element = findRowElement(rootRef.current, pendingFocusRowId);
        if (!element) return;
        element.focus();
        setPendingFocusRowId(undefined);
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [pendingFocusRowId]);

  const focusRow = (rowId: string) => {
    setFocusedRowId(rowId);
    const element = findRowElement(rootRef.current, rowId);
    if (element) {
      element.focus();
      return;
    }

    const rowIndex = getRowIndex(rows, rowId);
    if (rowIndex === -1) return;
    scrollToRow?.(rowIndex);
    setPendingFocusRowId(rowId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || isTextEditingTarget(event.target)) return;
    if (selection && isRangeNavigation(event)) {
      const current = findFocusedRowId(rootRef.current, event.target) ?? focusRowId;
      const target = adjacentNode(rows, current, event.key);
      if (target) {
        selection.select(target, event);
        focusRow(target);
      }
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    const navigation = resolveTreeListKeyboardNavigation({
      rows,
      focusedRowId: findFocusedRowId(rootRef.current, event.target) ?? focusRowId,
      activeNodeId,
      expandedNodeIds,
      key: event.key,
    });
    if (!navigation) return;

    event.preventDefault();
    if (navigation.type === "toggle-node") {
      onToggleNode?.(navigation.nodeId);
      return;
    }
    if (navigation.type === "toggle-section") {
      onToggleSection?.(navigation.sectionId);
      return;
    }

    focusRow(navigation.rowId);
  };

  return {
    focusRowId,
    rootRef,
    handleKeyDown,
    onRowFocus: (rowId: string) => {
      focusedElement.current = rootRef.current?.ownerDocument.activeElement as HTMLElement | null;
      setFocusedRowId(rowId);
    },
  };
};
