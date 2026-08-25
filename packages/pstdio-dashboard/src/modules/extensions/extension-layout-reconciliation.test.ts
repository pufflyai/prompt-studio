import { describe, expect, test } from "bun:test";
import type { WorkbenchLayout, WorkbenchRegion } from "@pstdio/workbench";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { legacyExtensionViewWidgetId } from "./extension-layout-legacy-aliases";
import { createExtensionLayoutCompatibility, reconcileExtensionLayout } from "./extension-layout-reconciliation";

const nativePanel = {
  id: "extension-lab.overview",
  extensionId: "pstdio.extension-lab",
  show: { region: "main" },
  title: "Overview",
  renderer: { kind: "tree", id: "extension-lab.overview" },
} satisfies DashboardExtensionMetadata["panels"][number];

const webviewPanel = {
  ...nativePanel,
  webview: {
    entry: { kind: "package-asset", path: "./overview.tsx", baseUrl: "file:///extension.ts" },
    runtimeUrl: "/runtime",
    moduleUrl: "/module.js",
  },
  renderer: undefined,
} satisfies DashboardExtensionMetadata["panels"][number];

const createMetadata = (panels: DashboardExtensionMetadata["panels"]): DashboardExtensionMetadata => ({
  extensions: [{ id: "pstdio.extension-lab", name: "extension-lab", displayName: "Extension Lab", sourcePath: "" }],
  commands: [],
  diagnostics: [],
  menuContributions: [],
  modes: [
    {
      id: "extension-lab.mode",
      extensionId: "pstdio.extension-lab",
      modeId: "extension-lab.mode",
      label: "Lab",
      panelRegions: ["main"],
      modePanels: { "extension-lab.overview": { region: "main" } },
    },
  ],
  panels,
  routes: [],
  settingsPanels: [],
});

const regions = [
  "nav",
  "activity",
  "sidenav-header",
  "sidenav",
  "main-header",
  "main-left-menu",
  "main",
  "main-right-menu",
  "secondary-header",
  "secondary-left-menu",
  "secondary",
  "secondary-right-menu",
  "side-header",
  "side-left-menu",
  "side",
  "side-right-menu",
  "status",
  "overlay",
] as const satisfies readonly WorkbenchRegion[];

const createLayout = () => {
  const layout: WorkbenchLayout = {
    regions: Object.fromEntries(
      regions.map((id) => [id, { id, visible: true, widgets: [] }]),
    ) as unknown as WorkbenchLayout["regions"],
  };
  return layout;
};

const withWidgets = (widgets: WorkbenchLayout["regions"]["main"]["widgets"]) => {
  const layout = createLayout();
  layout.regions.main.widgets = widgets;
  layout.regions.main.activeWidgetId = widgets[0]?.widgetId;
  layout.activeWidgetId = widgets[0]?.widgetId;
  layout.activeLocationWidgetId = widgets[0]?.widgetId;
  layout.activeResourceUri = widgets[0]?.resourceUri;
  layout.locationSubPanelSelections = { "resource://one": { main: widgets[0]?.widgetId } };
  return layout;
};

describe("extension layout compatibility", () => {
  test("is deterministic across metadata order changes", () => {
    const first = createMetadata([nativePanel, { ...nativePanel, id: "extension-lab.side", show: { region: "side" } }]);
    const second = { ...first, panels: [...first.panels].reverse(), modes: [...first.modes].reverse() };

    expect(createExtensionLayoutCompatibility(first)).toBe(createExtensionLayoutCompatibility(second));
  });

  test("changes only for layout-relevant metadata", () => {
    const base = createMetadata([nativePanel]);
    const commandChanged = {
      ...base,
      commands: [{ id: "extension-lab.run", extensionId: nativePanel.extensionId, title: "Run" }],
    } satisfies DashboardExtensionMetadata;
    const regionChanged = createMetadata([{ ...nativePanel, show: { region: "side" } }]);
    const modeChanged = {
      ...base,
      modes: base.modes.map((mode) => ({ ...mode, modeId: "extension-lab.other-mode" })),
    } satisfies DashboardExtensionMetadata;

    expect(createExtensionLayoutCompatibility(commandChanged)).toBe(createExtensionLayoutCompatibility(base));
    expect(createExtensionLayoutCompatibility(regionChanged)).not.toBe(createExtensionLayoutCompatibility(base));
    expect(createExtensionLayoutCompatibility(modeChanged)).not.toBe(createExtensionLayoutCompatibility(base));
  });
});

describe("extension layout reconciliation", () => {
  test("migrates a webview placement to native identity and removes the duplicate current placement", () => {
    const previousCompatibility = createExtensionLayoutCompatibility(createMetadata([webviewPanel]));
    const layout = withWidgets([
      {
        widgetId: legacyExtensionViewWidgetId(nativePanel.id),
        contributionId: legacyExtensionViewWidgetId(nativePanel.id),
        pinned: true,
        resource: {
          kind: "extension-view",
          id: nativePanel.id,
          uri: "resource://one",
          label: "Overview",
          metadata: { extensionId: nativePanel.extensionId },
        },
        resourceUri: "resource://one",
        tabRetention: "preview",
      },
      { widgetId: nativePanel.id, contributionId: nativePanel.id, resourceUri: "resource://one" },
      { widgetId: "dashboard.native", contributionId: "dashboard.native" },
    ]);

    const reconciled = reconcileExtensionLayout({
      layout,
      metadata: createMetadata([nativePanel]),
      previousCompatibility,
    });

    expect(reconciled.regions.main.widgets.map((placement) => placement.widgetId)).toEqual([
      nativePanel.id,
      "dashboard.native",
    ]);
    expect(reconciled.activeWidgetId).toBe(nativePanel.id);
    expect(reconciled.activeLocationWidgetId).toBe(nativePanel.id);
    expect(reconciled.locationSubPanelSelections?.[`${nativePanel.id}:${nativePanel.id}`]?.main).toBe(nativePanel.id);
    expect(reconciled.regions.main.widgets[0]).toMatchObject({
      pinned: true,
      viewId: nativePanel.id,
      tabRetention: "preview",
    });
    expect(reconciled.regions.main.widgets[0]?.resource).toBeUndefined();
  });

  test("moves a retained placement when its contribution region changes", () => {
    const previousCompatibility = createExtensionLayoutCompatibility(createMetadata([nativePanel]));
    const movedPanel = {
      ...nativePanel,
      show: { region: "side" },
    } satisfies DashboardExtensionMetadata["panels"][number];
    const layout = withWidgets([
      {
        widgetId: nativePanel.id,
        contributionId: nativePanel.id,
        pinned: true,
        resourceUri: "resource://one",
        tabRetention: "persistent",
      },
      { widgetId: "dashboard.native", contributionId: "dashboard.native" },
    ]);

    const reconciled = reconcileExtensionLayout({
      layout,
      metadata: createMetadata([movedPanel]),
      previousCompatibility,
    });

    expect(reconciled.regions.main.widgets.map((placement) => placement.widgetId)).toEqual(["dashboard.native"]);
    expect(reconciled.regions.side.widgets).toEqual([
      expect.objectContaining({
        widgetId: nativePanel.id,
        pinned: true,
        resourceUri: "resource://one",
        tabRetention: "persistent",
      }),
    ]);
    expect(reconciled.activeWidgetId).toBe(nativePanel.id);
    expect(reconciled.activeLocationWidgetId).toBe(nativePanel.id);
    expect(reconciled.locationSubPanelSelections?.["resource://one"]).toEqual({ side: nativePanel.id });
  });

  test("prunes removed extension panels while preserving unrelated placements", () => {
    const previousCompatibility = createExtensionLayoutCompatibility(createMetadata([webviewPanel]));
    const layout = withWidgets([
      {
        widgetId: legacyExtensionViewWidgetId(webviewPanel.id),
        contributionId: legacyExtensionViewWidgetId(webviewPanel.id),
        resource: {
          kind: "extension-view",
          id: webviewPanel.id,
          uri: "resource://one",
          label: "Overview",
          metadata: { extensionId: webviewPanel.extensionId },
        },
        resourceUri: "resource://one",
      },
      { widgetId: "dashboard.native", contributionId: "dashboard.native" },
    ]);

    const reconciled = reconcileExtensionLayout({ layout, metadata: createMetadata([]), previousCompatibility });

    expect(reconciled.regions.main.widgets.map((placement) => placement.widgetId)).toEqual(["dashboard.native"]);
    expect(reconciled.activeWidgetId).toBeUndefined();
    expect(reconciled.activeResourceUri).toBeUndefined();
    expect(reconciled.locationSubPanelSelections?.["resource://one"]).toEqual({});
  });

  test("recognizes native extension placements without resource metadata", () => {
    const metadata = createMetadata([nativePanel]);
    const layout = withWidgets([
      { widgetId: nativePanel.id, contributionId: nativePanel.id },
      { widgetId: "dashboard.native", contributionId: "dashboard.native" },
    ]);

    const reset = reconcileExtensionLayout({
      layout,
      metadata,
      resetExtensionId: nativePanel.extensionId,
    });
    expect(reset.regions.main.widgets.map((placement) => placement.widgetId)).toEqual(["dashboard.native"]);

    const removed = reconcileExtensionLayout({
      layout,
      metadata: createMetadata([]),
      previousCompatibility: createExtensionLayoutCompatibility(metadata),
    });
    expect(removed.regions.main.widgets.map((placement) => placement.widgetId)).toEqual(["dashboard.native"]);
  });
});
