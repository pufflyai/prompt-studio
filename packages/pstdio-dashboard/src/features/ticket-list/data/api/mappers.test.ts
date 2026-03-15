import { describe, expect, it } from "bun:test";
import type { StatusResponse } from "pstdio-api/dto";

import { toTicketStatusOption } from "./mappers";

const buildStatus = (name: string) =>
  ({
    id: "status-1",
    name,
    color: "blue",
    sort_order: 10,
    is_default: false,
  }) as StatusResponse;

describe("toTicketStatusOption", () => {
  it("does not expose attempt-on-drop metadata for WIP-like statuses", () => {
    const option = toTicketStatusOption(buildStatus("In Progress"));

    expect("canAttemptOnDrop" in option).toBe(false);
  });
});
