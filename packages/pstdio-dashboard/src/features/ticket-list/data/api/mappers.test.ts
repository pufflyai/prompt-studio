import { describe, expect, it } from "bun:test";

import { toTicketStatusOption } from "./mappers";
import type { PlannerStatus } from "./planner";

const buildStatus = (overrides: Partial<PlannerStatus> = {}) =>
  ({
    id: "status-1",
    name: "backlog",
    color: "blue",
    sortOrder: 10,
    isDefault: false,
    canCreate: false,
    canDragIn: true,
    canDragOut: true,
    columnActions: [],
    ...overrides,
  }) satisfies PlannerStatus;

describe("toTicketStatusOption", () => {
  it("computes actions from boolean flags", () => {
    const option = toTicketStatusOption(
      buildStatus({ canCreate: true, canDragIn: true, columnActions: ["archive_all"] }),
    );
    expect(option.actions).toEqual(["create_ticket", "drag_in", "drag_out", "archive_all"]);
  });
});
