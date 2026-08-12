import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import {
  clearCachedDashboardExtensionMetadata,
  emptyDashboardExtensionMetadata,
  setCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { resolveExtensionView } from "./components/extension-view-widget";
import {
  activateExtensionModeLayout,
  extensionViewRegion,
  registerExtensionModeContributions,
} from "./extension-mode-layout";
import { extensionViewWidgetId } from "./extension-view-placement";

describe("extension-mode-layout exports", () => {
  test("exposes extension view region placement for resource view callers", () => {
    expect(extensionViewRegion("sidenav")).toBe("sidenav");
  });

  test("honors webview panel and panel-menu placement", () => {
    const workbench = createWorkbenchCore();
    const webview = {
      entry: {
        kind: "package-asset" as const,
        path: "./panel.tsx",
        baseUrl: "file:///extension/extension.ts",
      },
      runtimeUrl: "/runtime.html",
      moduleUrl: "/panel.js",
    };
    const metadata = {
      ...emptyDashboardExtensionMetadata,
      panels: [
        {
          id: "pstdio-lab.last",
          extensionId: "pstdio.pstdio-lab",
          title: "Last",
          region: "main" as const,
          closable: false,
          placement: "last" as const,
          webview,
        },
        {
          id: "pstdio-lab.default",
          extensionId: "pstdio.pstdio-lab",
          title: "Default",
          region: "main" as const,
          closable: false,
          webview,
        },
        {
          id: "pstdio-lab.first",
          extensionId: "pstdio.pstdio-lab",
          title: "First",
          region: "main" as const,
          closable: false,
          placement: "first" as const,
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
      ],
    };

    registerExtensionModeContributions(workbench, metadata, "project-1");

    workbench.layout.openPanel(extensionViewWidgetId("pstdio-lab.last"), { strategy: { kind: "persistent" } });
    workbench.layout.openPanel(extensionViewWidgetId("pstdio-lab.default"), { strategy: { kind: "persistent" } });
    workbench.layout.openPanel(extensionViewWidgetId("pstdio-lab.first"), { strategy: { kind: "persistent" } });

    expect(workbench.layout.listPanelInstances("main").map((panel) => panel.panelId)).toEqual([
      extensionViewWidgetId("pstdio-lab.first"),
      extensionViewWidgetId("pstdio-lab.default"),
      extensionViewWidgetId("pstdio-lab.last"),
    ]);
    expect(workbench.layout.listPanelInstances("main-right-menu").map((panel) => panel.panelId)).toEqual([
      extensionViewWidgetId("pstdio-lab.first.menu-first"),
      extensionViewWidgetId("pstdio-lab.first.menu-default"),
      extensionViewWidgetId("pstdio-lab.first.menu-last"),
    ]);
  });

  test("tie-breaks equal-placement webview panel menus across owner panels by manifest declaration order", () => {
    const workbench = createWorkbenchCore();
    const webview = {
      entry: {
        kind: "package-asset" as const,
        path: "./panel.tsx",
        baseUrl: "file:///extension/extension.ts",
      },
      runtimeUrl: "/runtime.html",
      moduleUrl: "/panel.js",
    };
    const metadata = {
      ...emptyDashboardExtensionMetadata,
      panels: [
        {
          id: "pstdio-lab.a",
          extensionId: "pstdio.pstdio-lab",
          title: "Panel A",
          region: "main" as const,
          closable: false,
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
          region: "main" as const,
          closable: false,
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
});

describe("extension-mode-layout registration", () => {
  test("registers explicit Sub Panel views as project-scoped Add panel widgets", () => {
    const workbench = createWorkbenchCore();
    const metadata = {
      ...emptyDashboardExtensionMetadata,
      panels: [
        {
          id: "pstdio-lab.overview",
          extensionId: "pstdio.pstdio-lab",
          title: "Lab overview",
          region: "main" as const,
          closable: true,
          webview: {
            entry: {
              kind: "package-asset" as const,
              path: "./overview.tsx",
              baseUrl: "file:///extension/extension.ts",
            },
            runtimeUrl: "/runtime.html",
            moduleUrl: "/overview.js",
          },
        },
      ],
    };

    registerExtensionModeContributions(workbench, metadata, "project-1");

    const widget = workbench.layout.getPanel(extensionViewWidgetId("pstdio-lab.overview"))!;
    expect(widget).toMatchObject({
      closable: true,
      region: "main",
      config: { projectId: "project-1" },
    });

    setCachedDashboardExtensionMetadata("project-1", metadata);
    try {
      const placement = workbench.layout.openPanel(widget.id, {});
      expect(resolveExtensionView({ panel: widget, instance: placement })?.view.id).toBe("pstdio-lab.overview");
    } finally {
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("registers extension resource kinds declared by resource-bound modes", () => {
    const workbench = createWorkbenchCore();
    const metadata = {
      ...emptyDashboardExtensionMetadata,
      modes: [
        {
          id: "pstdio-lab.artifact",
          extensionId: "pstdio.pstdio-lab",
          modeId: "pstdio-lab.artifact",
          label: "Glass Lab artifact",
          icon: "FlaskConical",
          resourceKind: "glass-lab-artifact",
          layout: { panels: ["main" as const] },
        },
      ],
    };

    registerExtensionModeContributions(workbench, metadata, "project-1");

    expect(workbench.resources.getKind("glass-lab-artifact")).toMatchObject({
      kind: "glass-lab-artifact",
      label: "Glass Lab artifact",
      icon: "FlaskConical",
    });
  });

  test("opens Panel regions declared by a mode's initial layout", () => {
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
          layout: {
            panels: ["main", "secondary", "side"] as ("main" | "secondary" | "side")[],
            open: [{ region: "secondary" as const, panel: "pstdio-lab.checklist" }],
          },
        },
      ],
      panels: [
        {
          id: "pstdio-lab.checklist",
          extensionId: "pstdio.pstdio-lab",
          title: "Review checklist",
          region: "secondary" as const,
          closable: true,
          webview: {
            entry: {
              kind: "package-asset" as const,
              path: "./checklist.tsx",
              baseUrl: "file:///extension/extension.ts",
            },
            runtimeUrl: "/runtime.html",
            moduleUrl: "/checklist.js",
          },
        },
      ],
    };

    registerExtensionModeContributions(workbench, metadata, "project-1");
    workbench.panels.setOpen("secondary", false);
    workbench.layout.setRegionVisible("secondary", false);

    activateExtensionModeLayout({
      ctx: workbench,
      metadata,
      mode: metadata.modes[0],
      projectId: "project-1",
    });

    expect(workbench.panels.isOpen("secondary")).toBe(true);
    expect(workbench.layout.getLayout().regions.secondary.visible).toBe(true);
  });

  test("attaches the Side Panel when a mode's initial layout opens a side view", () => {
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
          layout: {
            panels: ["main", "secondary", "side"] as ("main" | "secondary" | "side")[],
            open: [{ region: "side" as const, panel: "pstdio-lab.parameters" }],
          },
        },
      ],
      panels: [
        {
          id: "pstdio-lab.parameters",
          extensionId: "pstdio.pstdio-lab",
          title: "Parameters",
          region: "side" as const,
          closable: false,
          webview: {
            entry: {
              kind: "package-asset" as const,
              path: "./parameters.tsx",
              baseUrl: "file:///extension/extension.ts",
            },
            runtimeUrl: "/runtime.html",
            moduleUrl: "/parameters.js",
          },
        },
      ],
    };

    registerExtensionModeContributions(workbench, metadata, "project-1");
    workbench.sidePanel.setMode("closed");

    activateExtensionModeLayout({
      ctx: workbench,
      metadata,
      mode: metadata.modes[0],
      projectId: "project-1",
    });

    expect(workbench.sidePanel.getMode()).toBe("attached");
  });
});

describe("extension-mode-layout mode chrome", () => {
  test("seeds activity and status chrome, owns the sidenav, and clears the chrome when leaving", () => {
    const workbench = createWorkbenchCore();
    const webview = {
      entry: {
        kind: "package-asset" as const,
        path: "./panel.tsx",
        baseUrl: "file:///extension/extension.ts",
      },
      runtimeUrl: "/runtime.html",
      moduleUrl: "/panel.js",
    };
    const metadata = {
      ...emptyDashboardExtensionMetadata,
      modes: [
        {
          id: "pstdio-lab.lab",
          extensionId: "pstdio.pstdio-lab",
          modeId: "pstdio-lab.lab",
          label: "Lab",
          icon: "FlaskConical",
          layout: {
            panels: ["main", "side"] as ("main" | "secondary" | "side")[],
            open: [
              { region: "activity" as const, panel: "pstdio-lab.rail", pinned: true },
              { region: "status" as const, panel: "pstdio-lab.statusStrip", pinned: true },
              { region: "main" as const, panel: "pstdio-lab.overview" },
            ],
          },
        },
      ],
      panels: [
        {
          id: "pstdio-lab.rail",
          extensionId: "pstdio.pstdio-lab",
          title: "Lab rail",
          region: "activity" as const,
          closable: false,
          webview,
        },
        {
          id: "pstdio-lab.statusStrip",
          extensionId: "pstdio.pstdio-lab",
          title: "Lab status",
          region: "status" as const,
          closable: false,
          webview,
        },
        {
          id: "pstdio-lab.overview",
          extensionId: "pstdio.pstdio-lab",
          title: "Overview",
          icon: "layout-dashboard",
          region: "main" as const,
          closable: false,
          webview,
        },
      ],
    };
    workbench.layout.registerPanel({
      id: "dashboard.sidenav",
      title: "Dashboard Sidenav",
      region: "sidenav",
      rendererId: "dashboard.sidenav",
      closable: false,
    });
    workbench.layout.openPanel("dashboard.sidenav", { pinned: true });
    registerExtensionModeContributions(workbench, metadata, "project-1");
    workbench.modes.registerMode({ id: "other", activate: () => undefined });

    workbench.modes.setActiveMode("pstdio-lab.lab");

    const layout = workbench.layout.getLayout();
    expect(layout.regions.activity.widgets.map((widget) => widget.contributionId)).toEqual([
      extensionViewWidgetId("pstdio-lab.rail"),
    ]);
    expect(layout.regions.status.widgets.map((widget) => widget.contributionId)).toEqual([
      extensionViewWidgetId("pstdio-lab.statusStrip"),
    ]);
    // A mode that stages its own activity rail owns navigation: the sidenav is cleared.
    expect(layout.regions.sidenav.widgets).toEqual([]);
    const overview = layout.regions.main.widgets.find(
      (widget) => widget.contributionId === extensionViewWidgetId("pstdio-lab.overview"),
    );
    expect(overview?.resource?.icon).toBe("layout-dashboard");

    workbench.modes.setActiveMode("other");

    const afterLeave = workbench.layout.getLayout();
    expect(afterLeave.regions.activity.widgets).toEqual([]);
    expect(afterLeave.regions.status.widgets).toEqual([]);
  });

  test("keeps eligibility-scoped main panels as sub-panels of the mode's single location", () => {
    const workbench = createWorkbenchCore();
    const webview = {
      entry: {
        kind: "package-asset" as const,
        path: "./panel.tsx",
        baseUrl: "file:///extension/extension.ts",
      },
      runtimeUrl: "/runtime.html",
      moduleUrl: "/panel.js",
    };
    const metadata = {
      ...emptyDashboardExtensionMetadata,
      modes: [
        {
          id: "pstdio-lab.lab",
          extensionId: "pstdio.pstdio-lab",
          modeId: "pstdio-lab.lab",
          label: "Lab",
          layout: {
            panels: ["main", "side"] as ("main" | "secondary" | "side")[],
            open: [
              { region: "main" as const, panel: "pstdio-lab.overview" },
              { region: "main" as const, panel: "pstdio-lab.cams" },
            ],
          },
        },
      ],
      panels: [
        {
          id: "pstdio-lab.overview",
          extensionId: "pstdio.pstdio-lab",
          title: "Overview",
          region: "main" as const,
          closable: false,
          webview,
        },
        {
          id: "pstdio-lab.cams",
          extensionId: "pstdio.pstdio-lab",
          title: "Cams",
          region: "main" as const,
          closable: false,
          eligibleLocations: { resourceKinds: ["extension-view"] },
          webview,
        },
      ],
    };

    registerExtensionModeContributions(workbench, metadata, "project-1");
    workbench.modes.setActiveMode("pstdio-lab.lab");

    const main = workbench.layout.getLayout().regions.main;
    const roleOf = (panelId: string) =>
      main.widgets.find((widget) => widget.contributionId === extensionViewWidgetId(panelId))?.role;
    expect(roleOf("pstdio-lab.overview")).toBe("location");
    // A panel that declares where it is eligible is a tab beside the location,
    // never a second location — locations would clone sub-panels per location.
    expect(roleOf("pstdio-lab.cams")).toBe("sub-panel");
    expect(main.widgets.filter((widget) => widget.role === "location")).toHaveLength(1);
  });
});

describe("extension-mode-layout native menus", () => {
  test("registers native-bodied panel menus of webview panels with their renderer ids", () => {
    const workbench = createWorkbenchCore();
    const webview = {
      entry: {
        kind: "package-asset" as const,
        path: "./panel.tsx",
        baseUrl: "file:///extension/extension.ts",
      },
      runtimeUrl: "/runtime.html",
      moduleUrl: "/panel.js",
    };
    const metadata = {
      ...emptyDashboardExtensionMetadata,
      panels: [
        {
          id: "pstdio-lab.cams",
          extensionId: "pstdio.pstdio-lab",
          title: "Cams",
          region: "main" as const,
          closable: false,
          webview,
          panelMenus: [
            {
              id: "pstdio-lab.cams.cameras",
              extensionId: "pstdio.pstdio-lab",
              ownerPanelId: "pstdio-lab.cams",
              title: "Cameras",
              side: "left" as const,
              treeRendererId: "pstdio-lab.camsTree",
            },
          ],
        },
      ],
    };

    registerExtensionModeContributions(workbench, metadata, "project-1");

    const menuWidget = workbench.layout.getPanel("pstdio-lab.cams.cameras");
    expect(menuWidget).toMatchObject({
      region: "main-left-menu",
      rendererId: "pstdio-lab.camsTree",
    });
  });

  test("reactivates an explicit mode Sidenav when returning to a seeded mode", () => {
    const workbench = createWorkbenchCore();
    const metadata = {
      ...emptyDashboardExtensionMetadata,
      modes: [
        {
          id: "pstdio-lab.build",
          extensionId: "pstdio.pstdio-lab",
          modeId: "pstdio-lab.build",
          label: "Build",
          icon: "FlaskConical",
          layout: {
            panels: ["main", "secondary", "side"] as ("main" | "secondary" | "side")[],
            open: [{ region: "sidenav" as const, panel: "pstdio-lab.sidenav", pinned: true }],
          },
        },
      ],
      panels: [
        {
          id: "pstdio-lab.sidenav",
          extensionId: "pstdio.pstdio-lab",
          title: "Lab Sidenav",
          region: "sidenav" as const,
          closable: false,
          webview: {
            entry: {
              kind: "package-asset" as const,
              path: "./sidenav.tsx",
              baseUrl: "file:///extension/extension.ts",
            },
            runtimeUrl: "/runtime.html",
            moduleUrl: "/sidenav.js",
          },
        },
      ],
    };
    workbench.layout.registerPanel({
      id: "dashboard.sidenav",
      title: "Dashboard Sidenav",
      region: "sidenav",
      rendererId: "dashboard.sidenav",
      closable: false,
    });
    registerExtensionModeContributions(workbench, metadata, "project-1");
    workbench.modes.registerMode({ id: "other", activate: () => undefined });
    workbench.modes.onDidChangeActive(() => {
      workbench.layout.openPanel("dashboard.sidenav");
    });

    workbench.modes.setActiveMode("pstdio-lab.build");
    workbench.modes.setActiveMode("other");
    workbench.modes.setActiveMode("pstdio-lab.build");

    expect(workbench.layout.getLayout().regions.sidenav.activeWidgetId).toBe(
      "dashboard-workbench.extension-view.pstdio-lab.sidenav",
    );
  });
});
