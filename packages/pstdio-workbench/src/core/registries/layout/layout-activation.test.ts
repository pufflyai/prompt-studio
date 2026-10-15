import { expect, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import { activateInLayout } from "./layout-operations";
import { createDefaultWorkbenchLayout } from "./layout-types";

test("activating a location preserves another placement's document reference", () => {
  const resource = { type: "ticket", id: "t1", metadata: { documentId: "first" } };
  const primary = {
    widgetId: "primary",
    contributionId: "editor",
    role: "location" as const,
    resource,
    resourceKey: resourceKey(resource),
  };
  const secondary = {
    widgetId: "secondary",
    contributionId: "editor",
    role: "sub-panel" as const,
    resource: { ...resource, label: "second.md", metadata: { documentId: "second" } },
    resourceKey: resourceKey(resource),
    ownerResourceKey: resourceKey(resource),
  };
  const layout = createDefaultWorkbenchLayout();
  layout.regions.main.widgets = [primary];
  layout.regions.side.widgets = [secondary];
  const next = activateInLayout(layout, "main", primary);
  expect(next.regions.side.widgets[0]?.resource).toEqual(secondary.resource);
});
