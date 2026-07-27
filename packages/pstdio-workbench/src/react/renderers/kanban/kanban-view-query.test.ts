import { describe, expect, test } from "bun:test";
import { createKanbanViewQuerySequencer } from "./kanban-view-query";

describe("createKanbanViewQuerySequencer", () => {
  test("only treats the most recent query as current", () => {
    const sequencer = createKanbanViewQuerySequencer();

    const first = sequencer.next();
    const second = sequencer.next();

    expect(sequencer.isLatest(first)).toBe(false);
    expect(sequencer.isLatest(second)).toBe(true);
  });
});
