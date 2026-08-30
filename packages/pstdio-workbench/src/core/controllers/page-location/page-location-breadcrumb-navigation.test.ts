import { describe, expect, test } from "bun:test";
import { createPageLocationHarness, ticketTarget, workspaceRef } from "./page-location-controller.test-support";

describe("page location breadcrumb navigation", () => {
  test("navigates an exact location without asking a resource presenter", () => {
    const harness = createPageLocationHarness();
    harness.controller.boot("p1");
    harness.controller.navigate({
      kind: "page",
      page: workspaceRef,
      resource: { type: "workspace", id: "WS-4" },
      parent: ticketTarget(),
    });
    const ticketLocation = harness.registry.store.getState().location?.parent;
    if (!ticketLocation) throw new Error("Expected contextual ticket location");
    const pushes = harness.browser.pushes.length;

    harness.controller.navigateLocation(ticketLocation);

    expect(harness.registry.store.getState().location).toEqual(ticketLocation);
    expect(harness.registry.store.getState().activePageId).toBe("ticket");
    expect(harness.registry.store.getState().location?.resource?.id).toBe("PS-326");
    expect(harness.browser.pushes).toHaveLength(pushes + 1);
  });
});
