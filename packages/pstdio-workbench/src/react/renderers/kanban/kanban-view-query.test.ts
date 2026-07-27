import { describe, expect, test } from "bun:test";
import { createKanbanViewQuerySequencer, executeKanbanViewQuery } from "./kanban-view-query";

describe("createKanbanViewQuerySequencer", () => {
  test("only treats the most recent query as current", () => {
    const sequencer = createKanbanViewQuerySequencer();

    const first = sequencer.next();
    const second = sequencer.next();

    expect(sequencer.isLatest(first)).toBe(false);
    expect(sequencer.isLatest(second)).toBe(true);
  });

  test("clears rows when a query fails", async () => {
    const rows = await executeKanbanViewQuery(() => Promise.reject(new Error("query failed")));

    expect(rows).toEqual([]);
  });
});
