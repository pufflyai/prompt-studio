import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import {
  clearCachedDashboardExtensionMetadata,
  emptyDashboardExtensionMetadata,
  setCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { resolveExtensionView } from "./components/extension-view-widget";
import { registerExtensionModeContributions } from "./extension-mode-layout";
import { extensionViewWidgetId } from "./extension-view-placement";

const webview = {
  entry: {
    kind: "package-asset" as const,
    path: "./panel.tsx",
    baseUrl: "file:///extension/extension.ts",
  },
  runtimeUrl: "/runtime.html",
  moduleUrl: "/panel.js",
};

describe("extension-mode-layout panel registration", () => {
  test("registers webview panels in manifest declaration order", () => {
    const workbench = createWorkbenchCore();
    const metadata = {
      ...emptyDashboardExtensionMetadata,
      panels: [
        {
          id: "pstdio-lab.first",
          extensionId: "pstdio.pstdio-lab",
          title: "First",
          show: { region: "main" as const },
          webview,
          panelMenus: [
            {
              id: "pstdio-lab.first.menu-last",
              extensionId: "pstdio.pstdio-lab",
              ownerPanelId: "pstdio-lab.first",
              title: "Menu Last",
              side: "right" as const,
              placement: "last" as const,
              webview,
            },
            {
              id: "pstdio-lab.first.menu-default",
              extensionId: "pstdio.pstdio-lab",
              ownerPanelId: "pstdio-lab.first",
              title: "Menu Default",
              side: "right" as const,
              webview,
            },
            {
              id: "pstdio-lab.first.menu-first",
              extensionId: "pstdio.pstdio-lab",
              ownerPanelId: "pstdio-lab.first",
              title: "Menu First",
              side: "right" as const,
              placement: "first" as const,
              webview,
            },
          ],
        },
        {
          id: "pstdio-lab.second",
          extensionId: "pstdio.pstdio-lab",
          title: "Second",
          show: { region: "main" as const },
          webview,
        },
        {
          id: "pstdio-lab.third",
          extensionId: "pstdio.pstdio-lab",
          title: "Third",
          show: { region: "main" as const },
          webview,
        },
      ],
    };

    registerExtensionModeContributions(workbench, metadata, "project-1");

    workbench.layout.openPanel(extensionViewWidgetId("pstdio-lab.third"), { strategy: { kind: "persistent" } });
    workbench.layout.openPanel(extensionViewWidgetId("pstdio-lab.second"), { strategy: { kind: "persistent" } });
    workbench.layout.openPanel(extensionViewWidgetId("pstdio-lab.first"), { strategy: { kind: "persistent" } });

    // Panels no longer declare a placement: manifest declaration order is the order.
    expect(workbench.layout.listPanelInstances("main").map((panel) => panel.panelId)).toEqual([
      extensionViewWidgetId("pstdio-lab.first"),
      extensionViewWidgetId("pstdio-lab.second"),
      extensionViewWidgetId("pstdio-lab.third"),
    ]);
    // Panel menus keep their placement.
    expect(workbench.layout.listPanelInstances("main-right-menu").map((panel) => panel.panelId)).toEqual([
      extensionViewWidgetId("pstdio-lab.first.menu-first"),
      extensionViewWidgetId("pstdio-lab.first.menu-default"),
      extensionViewWidgetId("pstdio-lab.first.menu-last"),
    ]);
  });

  test("tie-breaks equal-placement webview panel menus across owner panels by manifest declaration order", () => {
    const workbench = createWorkbenchCore();
    const metadata = {
      ...emptyDashboardExtensionMetadata,
      panels: [
        {
          id: "pstdio-lab.a",
          extensionId: "pstdio.pstdio-lab",
          title: "Panel A",
          show: { region: "main" as const },
          webview,
          panelMenus: [
            {
              id: "pstdio-lab.a.menu",
              extensionId: "pstdio.pstdio-lab",
              ownerPanelId: "pstdio-lab.a",
              title: "Menu A",
              side: "right" as const,
              webview,
            },
          ],
        },
        {
          id: "pstdio-lab.b",
          extensionId: "pstdio.pstdio-lab",
          title: "Panel B",
          show: { region: "main" as const },
          webview,
          panelMenus: [
            {
              id: "pstdio-lab.b.menu",
              extensionId: "pstdio.pstdio-lab",
              ownerPanelId: "pstdio-lab.b",
              title: "Menu B",
              side: "right" as const,
              webview,
            },
          ],
        },
      ],
    };

    registerExtensionModeContributions(workbench, metadata, "project-1");

    workbench.layout.openPanel(extensionViewWidgetId("pstdio-lab.b"), { strategy: { kind: "persistent" } });
    workbench.layout.openPanel(extensionViewWidgetId("pstdio-lab.a"), { strategy: { kind: "persistent" } });

    expect(workbench.layout.listPanelInstances("main-right-menu").map((panel) => panel.panelId)).toEqual([
      extensionViewWidgetId("pstdio-lab.a.menu"),
      extensionViewWidgetId("pstdio-lab.b.menu"),
    ]);
  });

  test("registers a webview panel as a project-scoped Add panel widget", () => {
    const workbench = createWorkbenchCore();
    const metadata = {
      ...emptyDashboardExtensionMetadata,
      panels: [
        {
          id: "pstdio-lab.overview",
          extensionId: "pstdio.pstdio-lab",
          title: "Lab overview",
          show: { region: "main" as const },
          webview,
        },
      ],
    };

    registerExtensionModeContributions(workbench, metadata, "project-1");

    const widget = workbench.layout.getPanel(extensionViewWidgetId("pstdio-lab.overview"))!;
    expect(widget).toMatchObject({ region: "main", config: { projectId: "project-1" } });

    setCachedDashboardExtensionMetadata("project-1", metadata);
    try {
      const placement = workbench.layout.openPanel(widget.id, {});
      expect(resolveExtensionView({ panel: widget, instance: placement })?.view.id).toBe("pstdio-lab.overview");
    } finally {
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("keeps an unscoped panel available outside its resource-panel edges", () => {
    const workbench = createWorkbenchCore();
    const metadata = {
      ...emptyDashboardExtensionMetadata,
      panels: [
        {
          id: "pstdio-lab.editor",
          extensionId: "pstdio.pstdio-lab",
          title: "Editor",
          show: { region: "main" as const },
          webview,
        },
      ],
      resourceKinds: [
        {
          id: "glass-lab-artifact",
          extensionId: "pstdio.pstdio-lab",
          surface: "primary" as const,
          label: "Glass Lab artifact",
          icon: "FlaskConical",
          slots: { primary: { cardinality: "one" as const, external: false } },
        },
      ],
      resourcePanels: [
        {
          id: "pstdio-lab.artifact.primary",
          extensionId: "pstdio.pstdio-lab",
          resourceKind: "glass-lab-artifact",
          panel: "pstdio-lab.editor",
          slot: "primary",
        },
      ],
    };

    registerExtensionModeContributions(workbench, metadata, "project-1");

    expect(workbench.layout.getPanel(extensionViewWidgetId("pstdio-lab.editor"))?.resourceKinds).toBeUndefined();
    expect(workbench.resources.getKind("glass-lab-artifact")).toMatchObject({
      kind: "glass-lab-artifact",
      label: "Glass Lab artifact",
      icon: "FlaskConical",
    });
  });
});

describe("extension-mode-layout mode composition", () => {
  test("opens and reveals the regions a mode recipe fills", () => {
    const workbench = createWorkbenchCore();
    const metadata = {
      ...emptyDashboardExtensionMetadata,
      modes: [
        {
          id: "pstdio-lab.review",
          extensionId: "pstdio.pstdio-lab",
          modeId: "pstdio-lab.review",
          label: "Review lab",
          icon: "ScanSearch",
          panelRegions: ["main", "secondary", "side"] as ("main" | "secondary" | "side")[],
          modePanels: { "pstdio-lab.checklist": { region: "secondary" as const } },
        },
      ],
      panels: [
        {
          id: "pstdio-lab.checklist",
          extensionId: "pstdio.pstdio-lab",
          title: "Review checklist",
          show: { region: "secondary" as const },
          webview,
        },
      ],
    };

    registerExtensionModeContributions(workbench, metadata, "project-1");
    workbench.panels.setOpen("secondary", false);
    workbench.layout.setRegionVisible("secondary", false);

    workbench.modes.setActiveMode("pstdio-lab.review");

    expect(workbench.layout.getLayout().regions.secondary.widgets.map((widget) => widget.contributionId)).toEqual([
      extensionViewWidgetId("pstdio-lab.checklist"),
    ]);
    expect(workbench.panels.isOpen("secondary")).toBe(true);
    expect(workbench.layout.getLayout().regions.secondary.visible).toBe(true);
  });

  test("attaches the Side Panel when a mode recipe places a side panel", () => {
    const workbench = createWorkbenchCore();
    const metadata = {
      ...emptyDashboardExtensionMetadata,
      modes: [
        {
          id: "pstdio-lab.design",
          extensionId: "pstdio.pstdio-lab",
          modeId: "pstdio-lab.design",
          label: "Parameter lab",
          icon: "SlidersHorizontal",
          panelRegions: ["main", "secondary", "side"] as ("main" | "secondary" | "side")[],
          modePanels: { "pstdio-lab.parameters": { region: "side" as const } },
        },
      ],
      panels: [
        {
          id: "pstdio-lab.parameters",
          extensionId: "pstdio.pstdio-lab",
          title: "Parameters",
          show: { region: "side" as const },
          webview,
        },
      ],
    };

    registerExtensionModeContributions(workbench, metadata, "project-1");
    workbench.sidePanel.setMode("closed");

    workbench.modes.setActiveMode("pstdio-lab.design");

    expect(workbench.sidePanel.getMode()).toBe("attached");
  });

  test("restores a required placement the user could not have closed when the mode is reselected", () => {
    const workbench = createWorkbenchCore();
    const metadata = {
      ...emptyDashboardExtensionMetadata,
      modes: [
        {
          id: "pstdio-lab.build",
          extensionId: "pstdio.pstdio-lab",
          modeId: "pstdio-lab.build",
          label: "Build",
          panelRegions: ["main"] as ("main" | "secondary" | "side")[],
          modePanels: { "pstdio-lab.overview": { region: "main" as const, required: true } },
        },
      ],
      panels: [
        {
          id: "pstdio-lab.overview",
          extensionId: "pstdio.pstdio-lab",
          title: "Overview",
          show: { region: "main" as const },
          webview,
        },
      ],
    };

    registerExtensionModeContributions(workbench, metadata, "project-1");
    workbench.modes.setActiveMode("pstdio-lab.build");

    const widgetId = extensionViewWidgetId("pstdio-lab.overview");
    const placement = workbench.layout
      .getLayout()
      .regions.main.widgets.find((widget) => widget.contributionId === widgetId)!;
    // The composition resolver, not the panel record, decides closability.
    expect(placement.closable).toBe(false);

    workbench.layout.removeWidgetPlacement(placement.widgetId);
    expect(workbench.layout.getLayout().regions.main.widgets).toEqual([]);

    // Reselecting the active mode reconciles required structure instead of doing nothing.
    workbench.modes.setActiveMode("pstdio-lab.build");
    expect(workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.contributionId)).toEqual([
      widgetId,
    ]);
  });
});
