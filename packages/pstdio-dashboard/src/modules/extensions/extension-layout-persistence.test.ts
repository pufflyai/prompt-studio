import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import { migrateAlpha3ExtensionLayout } from "./extension-layout-persistence";
import { metadata } from "./module-test-fixtures";

const extensionId = "pstdio.extension-lab";
const viewId = `${extensionId}.view.overview`;
const alpha3ViewId = "extension-lab.overview";

const alpha4Metadata = {
  ...metadata,
  views: [
    {
      id: viewId,
      localId: "overview",
      extensionId,
      title: "Overview",
      body: { kind: "tree" as const, bodyHandlerId: `${viewId}.body` },
    },
  ],
} satisfies ResolvedWorkbenchExtensionMetadata;

describe("alpha.4 extension layout migration", () => {
  test("rewrites alpha.3 identities and removes persisted chrome", () => {
    const layout = createWorkbenchCore().layout.getLayout();
    layout.regions.main.widgets = [
      { widgetId: alpha3ViewId, contributionId: alpha3ViewId, viewId: alpha3ViewId, pinned: true },
    ];
    layout.regions.main.activeWidgetId = alpha3ViewId;
    layout.activeWidgetId = alpha3ViewId;
    layout.regions.status.widgets = [
      { widgetId: "extension-lab.status", contributionId: "extension-lab.status", pinned: true },
    ];
    layout.regions.status.activeWidgetId = "extension-lab.status";

    const migrated = migrateAlpha3ExtensionLayout(layout, alpha4Metadata);

    expect(migrated.regions.main.widgets[0]).toMatchObject({
      widgetId: viewId,
      contributionId: viewId,
      viewId,
      pinned: true,
    });
    expect(migrated.activeWidgetId).toBe(viewId);
    expect(migrated.regions.status.widgets).toEqual([]);
    expect(migrated.regions.status.activeWidgetId).toBeUndefined();
  });
});
