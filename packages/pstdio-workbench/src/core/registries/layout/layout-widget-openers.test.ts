import { describe, expect, test } from "bun:test";
import { createLayoutModel } from "./layout-model";
import { registerTestWidget } from "./layout-model-test-utils";

describe("layout widget openers", () => {
  test("binds an unowned singleton Sub Panel instead of opening a duplicate", () => {
    const layout = createLayoutModel();
    const resource = { kind: "ticket", uri: "pstdio://ticket/PS-1", label: "PS-1" };

    registerTestWidget(layout, { id: "ticket.editor", title: "Ticket", region: "main", singleton: true });
    registerTestWidget(layout, {
      id: "ticket.inspector",
      title: "Inspector",
      region: "side",
      singleton: true,
      eligibleLocations: { resourceKinds: ["ticket"] },
    });

    layout.openWidget("ticket.editor", { role: "location" });
    layout.openWidget("ticket.inspector", { role: "sub-panel" });
    layout.openWidget("ticket.editor", { resource, role: "location" });
    layout.openWidget("ticket.inspector", { resource, role: "sub-panel" });

    expect(layout.getLayout().regions.side.widgets).toEqual([
      expect.objectContaining({
        contributionId: "ticket.inspector",
        ownerResourceUri: resource.uri,
        resourceUri: resource.uri,
      }),
    ]);
  });
});
