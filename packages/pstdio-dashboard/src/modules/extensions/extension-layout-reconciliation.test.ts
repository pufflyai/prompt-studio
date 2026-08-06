import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, type WorkbenchLayout } from "@pstdio/workbench";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import {
  createExtensionLayoutCompatibility,
  reconcileExtensionLayout,
  resetExtensionLayout,
} from "./extension-layout-reconciliation";
import { extensionViewWidgetId } from "./extension-view-placement";

const extension = {
  id: "pstdio.extension-lab",
  name: "extension-lab",
  displayName: "Extension Lab",
  sourcePath: "/extensions/extension-lab",
};

const metadataWithPanel = (panel: { dataTableRendererId?: string; id: string; webview?: boolean }) => ({
  ...emptyDashboardExtensionMetadata,
  extensions: [extension],
  panels: [
    {
      id: panel.id,
      ...(panel.dataTableRendererId ? { dataTableRendererId: panel.dataTableRendererId } : {}),
      ...(panel.webview
        ? {
            webview: {
              entry: { kind: "package-asset" as const, path: "./overview.tsx", baseUrl: "file:///extension.ts" },
              runtimeUrl: "/runtime",
              moduleUrl: "/module.js",
            },
          }
        : {}),
      extensionId: extension.id,
      title: "Overview",
      region: "main" as const,
      closable: false,
    },
  ],
});

const placement = (contributionId: string, widgetId = contributionId) => ({
  contributionId,
  widgetId,
  closable: false,
});

const layoutWithMain = (widgets: WorkbenchLayout["regions"]["main"]["widgets"]): WorkbenchLayout => {
  const layout = createWorkbenchCore().layout.getLayout();
  const activeWidgetId = widgets.at(-1)?.widgetId;
  return {
    ...layout,
    activeWidgetId,
    activeLocationWidgetId: activeWidgetId,
    activeResourceUri: "extension://overview",
    locationSubPanelSelections: {
      "extension://overview": { main: activeWidgetId, secondary: "removed.secondary" },
    },
    regions: {
      ...layout.regions,
      main: { ...layout.regions.main, widgets, activeWidgetId },
    },
  };
};

describe("extension layout reconciliation", () => {
  test("migrates a persisted webview body to its renderer-backed logical view without duplicating the tab", () => {
    const previous = createExtensionLayoutCompatibility(
      metadataWithPanel({ id: "extension-lab.overview", webview: true }),
    );
    const current = createExtensionLayoutCompatibility(
      metadataWithPanel({ id: "extension-lab.overview", dataTableRendererId: "extension-lab.overview.table" }),
    );
    const legacyId = extensionViewWidgetId("extension-lab.overview");
    const layout = layoutWithMain([
      placement("native.notes"),
      placement(legacyId),
      placement("native.scratch"),
      placement("extension-lab.overview"),
    ]);

    const reconciled = reconcileExtensionLayout({ current, layout, previous });

    expect(reconciled.regions.main.widgets.map((entry) => entry.contributionId)).toEqual([
      "native.notes",
      "extension-lab.overview",
      "native.scratch",
    ]);
    expect(reconciled.regions.main.activeWidgetId).toBe("extension-lab.overview");
    expect(reconciled.activeWidgetId).toBe("extension-lab.overview");
    expect(reconciled.activeLocationWidgetId).toBe("extension-lab.overview");
    expect(reconciled.activeResourceUri).toBe("extension://overview");
    expect(reconciled.locationSubPanelSelections).toEqual({
      "extension://overview": { main: "extension-lab.overview" },
    });
  });

  test("prunes removed and renamed extension views while retaining unrelated placements in order", () => {
    const previous = createExtensionLayoutCompatibility({
      ...emptyDashboardExtensionMetadata,
      extensions: [extension],
      panels: [
        {
          id: "extension-lab.removed",
          extensionId: extension.id,
          title: "Removed",
          region: "main",
          closable: false,
          treeRendererId: "extension-lab.removed.tree",
        },
      ],
    });
    const current = createExtensionLayoutCompatibility({
      ...emptyDashboardExtensionMetadata,
      extensions: [extension],
      panels: [],
    });
    const initialLayout = layoutWithMain([
      placement("native.notes"),
      placement("extension-lab.removed"),
      placement("native.scratch"),
    ]);
    const layout = {
      ...initialLayout,
      activeWidgetId: "extension-lab.removed",
      activeLocationWidgetId: "extension-lab.removed",
      locationSubPanelSelections: {
        "extension://overview": { main: "extension-lab.removed", secondary: "removed.secondary" },
      },
      regions: {
        ...initialLayout.regions,
        main: { ...initialLayout.regions.main, activeWidgetId: "extension-lab.removed" },
      },
    };

    const reconciled = reconcileExtensionLayout({ current, layout, previous });

    expect(reconciled.regions.main.widgets.map((entry) => entry.contributionId)).toEqual([
      "native.notes",
      "native.scratch",
    ]);
    expect(reconciled.regions.main.activeWidgetId).toBe("native.notes");
    expect(reconciled.activeWidgetId).toBe("native.notes");
    expect(reconciled.activeLocationWidgetId).toBeUndefined();
    expect(reconciled.activeResourceUri).toBeUndefined();
    expect(reconciled.locationSubPanelSelections).toEqual({ "extension://overview": {} });
  });

  test("retains unrelated multi-instance placements with the same contribution and resource", () => {
    const current = createExtensionLayoutCompatibility(
      metadataWithPanel({ id: "extension-lab.overview", webview: true }),
    );
    const resource = { kind: "dashboard-view", uri: "dashboard://start", id: "start", label: "Start" };
    const layout = layoutWithMain([
      { ...placement("workbench.terminal"), resource, resourceUri: resource.uri },
      { ...placement("workbench.terminal", "workbench.terminal:1"), resource, resourceUri: resource.uri },
    ]);

    const reconciled = reconcileExtensionLayout({ current, layout });

    expect(reconciled.regions.main.widgets.map((entry) => entry.widgetId)).toEqual([
      "workbench.terminal",
      "workbench.terminal:1",
    ]);
  });

  test("produces a deterministic compatibility revision for the current contribution identities", () => {
    const first = createExtensionLayoutCompatibility(
      metadataWithPanel({ id: "extension-lab.overview", webview: true }),
    );
    const repeated = createExtensionLayoutCompatibility(
      metadataWithPanel({ id: "extension-lab.overview", webview: true }),
    );
    const rendererBacked = createExtensionLayoutCompatibility(
      metadataWithPanel({ id: "extension-lab.overview", dataTableRendererId: "extension-lab.overview.table" }),
    );

    expect(repeated.revision).toBe(first.revision);
    expect(rendererBacked.revision).not.toBe(first.revision);
  });

  test("resets only placements owned by the targeted extension", () => {
    const current = createExtensionLayoutCompatibility({
      ...emptyDashboardExtensionMetadata,
      extensions: [
        extension,
        { id: "pstdio.notes", name: "notes", displayName: "Notes", sourcePath: "/extensions/notes" },
      ],
      panels: [
        {
          id: "extension-lab.overview",
          extensionId: extension.id,
          title: "Overview",
          region: "main",
          closable: false,
          treeRendererId: "extension-lab.overview.tree",
        },
        {
          id: "notes.editor",
          extensionId: "pstdio.notes",
          title: "Notes",
          region: "main",
          closable: false,
          fileRendererId: "notes.editor.file",
        },
      ],
    });
    const layout = layoutWithMain([
      placement("native.start"),
      placement("extension-lab.overview"),
      placement("notes.editor"),
    ]);

    const reset = resetExtensionLayout(layout, current, extension.id);

    expect(reset.regions.main.widgets.map((entry) => entry.contributionId)).toEqual(["native.start", "notes.editor"]);
  });
});
