import { expect, test } from "bun:test";
import { createDashboardResource } from "./resources";

test("createDashboardResource encodes resource ids in canonical dashboard uris", () => {
  expect(createDashboardResource("ticket", "folder/ticket 1", "Ticket", "component").uri).toBe(
    "dashboard-workbench://ticket/folder%2Fticket%201",
  );
});
