import { describe, expect, test } from "bun:test";
import { applyBoardMoveItem, applyBoardMoveToGroup } from "./data-renderer-board-move";
import type { DataRendererSettings } from "./types";
import { NO_GROUPING } from "./types";

const baseSettings: Pick<DataRendererSettings, "columnGrouping" | "ordering" | "rowGrouping"> = {
  columnGrouping: "status",
  rowGrouping: NO_GROUPING,
  ordering: { attributeId: "manual", direction: "asc" },
};

describe("applyBoardMoveItem", () => {
  test("updates the board column and manual order target", async () => {
    const calls: unknown[] = [];

    await applyBoardMoveItem({
      settings: baseSettings,
      rowId: "ticket-3",
      targetColumnId: "done",
      beforeItemId: "ticket-1",
      onAttributeChange: (...args) => calls.push(["attribute", ...args]),
      onReorder: (...args) => calls.push(["reorder", ...args]),
    });

    expect(calls).toEqual([
      ["attribute", "ticket-3", "status", "done"],
      ["reorder", "ticket-3", "ticket-1"],
    ]);
  });

  test("waits for the board column update before manual reordering", async () => {
    const calls: string[] = [];
    let finishAttributeChange: (() => void) | undefined;

    const move = applyBoardMoveItem({
      settings: baseSettings,
      rowId: "ticket-3",
      targetColumnId: "done",
      beforeItemId: "ticket-1",
      onAttributeChange: async () => {
        calls.push("attribute:start");
        await new Promise<void>((resolve) => {
          finishAttributeChange = resolve;
        });
        calls.push("attribute:end");
      },
      onReorder: () => calls.push("reorder"),
    });

    await Promise.resolve();
    expect(calls).toEqual(["attribute:start"]);

    finishAttributeChange?.();
    await move;

    expect(calls).toEqual(["attribute:start", "attribute:end", "reorder"]);
  });

  test("waits for board group updates before manual reordering", async () => {
    const calls: string[] = [];
    let finishGroupChange: (() => void) | undefined;

    const move = applyBoardMoveItem({
      settings: { ...baseSettings, rowGrouping: "priority" },
      rowId: "ticket-3",
      targetColumnId: "done",
      targetGroupKey: "high",
      beforeItemId: "ticket-1",
      onAttributeChange: async (_rowId, attributeId) => {
        calls.push(`${attributeId}:start`);
        if (attributeId !== "priority") return;
        await new Promise<void>((resolve) => {
          finishGroupChange = resolve;
        });
        calls.push(`${attributeId}:end`);
      },
      onReorder: () => calls.push("reorder"),
    });

    await Promise.resolve();
    expect(calls).toEqual(["status:start", "priority:start"]);

    finishGroupChange?.();
    await move;

    expect(calls).toEqual(["status:start", "priority:start", "priority:end", "reorder"]);
  });

  test("skips reordering when board ordering is not manual", async () => {
    const calls: unknown[] = [];

    await applyBoardMoveItem({
      settings: { ...baseSettings, ordering: { attributeId: "created", direction: "desc" } },
      rowId: "ticket-3",
      targetColumnId: "done",
      beforeItemId: "ticket-1",
      onAttributeChange: (...args) => calls.push(["attribute", ...args]),
      onReorder: (...args) => calls.push(["reorder", ...args]),
    });

    expect(calls).toEqual([["attribute", "ticket-3", "status", "done"]]);
  });
});

describe("applyBoardMoveToGroup", () => {
  test("updates the board group and manual order target", async () => {
    const calls: unknown[] = [];

    await applyBoardMoveToGroup({
      settings: { ...baseSettings, rowGrouping: "priority" },
      rowId: "ticket-3",
      targetGroupKey: "high",
      beforeItemId: "ticket-1",
      onAttributeChange: (...args) => calls.push(["attribute", ...args]),
      onReorder: (...args) => calls.push(["reorder", ...args]),
    });

    expect(calls).toEqual([
      ["attribute", "ticket-3", "priority", "high"],
      ["reorder", "ticket-3", "ticket-1"],
    ]);
  });
});
