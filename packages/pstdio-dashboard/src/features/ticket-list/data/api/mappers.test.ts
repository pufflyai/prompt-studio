import { describe, expect, it } from "bun:test";
import type { StatusResponse } from "pstdio-api/dto";

import { toTicketStatusOption } from "./mappers";

const buildStatus = (overrides: Partial<StatusResponse> = {}) =>
  ({
    id: "status-1",
    name: "backlog",
    color: "blue",
    sort_order: 10,
    is_default: false,
    can_create: false,
    can_drag_in: true,
    can_drag_out: true,
    column_actions: [],
    ...overrides,
  }) as StatusResponse;

describe("toTicketStatusOption", () => {
  it("computes actions from boolean flags", () => {
    const option = toTicketStatusOption(
      buildStatus({ can_create: true, can_drag_in: true, column_actions: ["archive_all"] }),
    );
    expect(option.actions).toEqual(["create_ticket", "drag_in", "drag_out", "archive_all"]);
  });
});
