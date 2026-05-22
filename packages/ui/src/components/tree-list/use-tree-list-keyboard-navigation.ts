import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  getFocusableRows,
  getRowFocusId,
  isFocusableRow,
  resolveTreeListFocusRowId,
  resolveTreeListKeyboardNavigation,
  type VirtualRow,
} from "./tree-list-model";

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

export const useTreeListKeyboardNavigation = (input: {
  rows: VirtualRow[];
  activeNodeId?: string | string[] | null;
  expandedNodeIds: string[];
  onToggleNode?: (nodeId: string) => void;
  onToggleSection?: (sectionId: string) => void;
  scrollToRow?: (index: number) => void;
}) => {
  const { rows, activeNodeId, expandedNodeIds, onToggleNode, onToggleSection, scrollToRow } = input;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [focusedRowId, setFocusedRowId] = useState<string>();
  const [pendingFocusRowId, setPendingFocusRowId] = useState<string>();
  const focusRowId = resolveTreeListFocusRowId(focusedRowId, activeNodeId, rows);
  const focusableRowIds = getFocusableRows(rows).map(getRowFocusId).join("\0");

  useEffect(() => {
    if (!focusedRowId) return;
    if (focusableRowIds.split("\0").includes(focusedRowId)) return;
    setFocusedRowId(undefined);
  }, [focusedRowId, focusableRowIds]);

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
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (isTextEditingTarget(event.target)) return;

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
    onRowFocus: (rowId: string) => setFocusedRowId(rowId),
  };
};
