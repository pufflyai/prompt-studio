import { expect, test } from "bun:test";
import type { WorkbenchPanelInstance } from "../layout/layout-types";
import { rendererReadKey } from "./renderer-read-key";

test("reopening a resource-less placement keeps its read owner while duplicate placements stay separate", () => {
  const placement: WorkbenchPanelInstance = {
    instanceId: "mounted-1",
    panelId: "tickets",
    closable: true,
    placementIdentity: { kind: "page", pageId: "tickets", slotId: "main", instanceKey: "first" },
  };
  expect(rendererReadKey({ ...placement, instanceId: "mounted-2" })).toBe(rendererReadKey(placement));
  expect(
    rendererReadKey({ ...placement, placementIdentity: { ...placement.placementIdentity!, instanceKey: "second" } }),
  ).not.toBe(rendererReadKey(placement));
});
