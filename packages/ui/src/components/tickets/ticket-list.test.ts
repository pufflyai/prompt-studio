import { describe, expect, it } from "bun:test";

import { classifyRowDragState, extractColumnKey, isGroupRowId } from "./ticket-list";

describe("extractColumnKey", () => {
  it("extracts the column key from grouped ids", () => {
    expect(extractColumnKey("group::in_progress")).toBe("in_progress");
  });

  it("returns plain ids unchanged", () => {
    expect(extractColumnKey("todo")).toBe("todo");
  });
});

describe("isGroupRowId", () => {
  it("identifies group rows", () => {
    expect(isGroupRowId("group::todo")).toBe(true);
    expect(isGroupRowId("group::todo::alice")).toBe(true);
  });

  it("does not treat ticket rows as groups", () => {
    expect(isGroupRowId("ticket-1")).toBe(false);
  });
});

describe("classifyRowDragState", () => {
  it("keeps empty top-level groups as drop targets", () => {
    const state = classifyRowDragState({
      rowId: "group::todo",
      rowDepth: 0,
      draggable: true,
      hasMoveHandler: true,
    });

    expect(state.isTopLevelGroupRow).toBe(true);
    expect(state.isDropTargetRow).toBe(true);
    expect(state.isDraggableRow).toBe(false);
  });

  it("never marks group rows draggable", () => {
    const state = classifyRowDragState({
      rowId: "group::todo",
      rowDepth: 0,
      draggable: true,
      hasMoveHandler: true,
      draggableItemIds: new Set(["group::todo"]),
    });

    expect(state.isDraggableRow).toBe(false);
  });

  it("respects explicit drag and drop permission sets", () => {
    const allowedTicket = classifyRowDragState({
      rowId: "ticket-1",
      rowDepth: 1,
      draggable: true,
      hasMoveHandler: true,
      draggableItemIds: new Set(["ticket-1"]),
      dropTargetGroupIds: new Set(["group::done"]),
    });

    const blockedGroup = classifyRowDragState({
      rowId: "group::todo",
      rowDepth: 0,
      draggable: true,
      hasMoveHandler: true,
      dropTargetGroupIds: new Set(["group::done"]),
    });

    expect(allowedTicket.isDraggableRow).toBe(true);
    expect(blockedGroup.isDropTargetRow).toBe(false);
  });
});
