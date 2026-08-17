import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { registerExtensionModeContributions } from "./extension-mode-layout";
import { extensionViewWidgetId } from "./extension-view-placement";

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
              renderer: { kind: "tree" as const, id: "pstdio-lab.camsTree" },
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
