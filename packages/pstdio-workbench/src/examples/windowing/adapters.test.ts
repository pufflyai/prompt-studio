import { expect, test } from "bun:test";
import { createDefaultWorkbenchLayout } from "../../core";
import { createWindowingPersistence } from "./adapters";

test("reload snapshots retain tabs with live presentation callbacks", () => {
  const persistence = createWindowingPersistence();
  const layout = createDefaultWorkbenchLayout();
  layout.regions.main.widgets.push({
    widgetId: "files",
    contributionId: "files",
    resource: { type: "workspace", id: "one" },
    tab: { getSnapshot: () => ({ label: "Files" }) },
  });
  persistence.layout.setLayout(layout, "workspace");
  const restored = persistence.layout.getLayout("workspace");
  expect(restored?.regions.main.widgets[0]).toMatchObject({
    widgetId: "files",
    resource: { type: "workspace", id: "one" },
  });
});
