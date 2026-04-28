import { describe, expect, it } from "bun:test";
import type { TicketStatusOption } from "@/features/ticket-list/types";
import { withPlannerFallbackStatus } from "./planner-status-fallback";

describe("withPlannerFallbackStatus", () => {
  it("provides a creatable fallback column when planner has no status rows", () => {
    expect(withPlannerFallbackStatus([])).toEqual([
      expect.objectContaining({
        name: "Unassigned",
        canCreate: true,
      }),
    ]);
  });

  it("preserves planner-owned status rows", () => {
    const statuses: TicketStatusOption[] = [
      {
        id: "backlog",
        name: "backlog",
        color: "blue",
        sortOrder: 1,
        isDefault: true,
        canDragOut: true,
        canDragIn: true,
        canCreate: true,
        columnActions: [],
        actions: ["create_ticket", "drag_in", "drag_out"],
      },
    ];

    expect(withPlannerFallbackStatus(statuses)).toEqual(statuses);
  });
});
