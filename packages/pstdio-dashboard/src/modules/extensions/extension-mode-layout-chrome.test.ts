import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
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

const registerHostSidenav = (workbench: ReturnType<typeof createWorkbenchCore>) => {
  workbench.layout.registerPanel({
    id: "dashboard.sidenav",
    title: "Dashboard Sidenav",
    region: "sidenav",
    rendererId: "dashboard.sidenav",
  });
};

describe("extension-mode-layout mode chrome", () => {
  test("shows a status item only while one of its modes is active", () => {
    const workbench = createWorkbenchCore();
    const metadata = {
      ...emptyDashboardExtensionMetadata,
      modes: [
        {
          id: "pstdio-lab.lab",
          extensionId: "pstdio.pstdio-lab",
          modeId: "pstdio-lab.lab",
          label: "Lab",
          icon: "FlaskConical",
          panelRegions: ["main"] as ("main" | "secondary" | "side")[],
          modePanels: { "pstdio-lab.overview": { region: "main" as const, required: true } },
        },
      ],
      panels: [
        {
          id: "pstdio-lab.overview",
          extensionId: "pstdio.pstdio-lab",
          title: "Overview",
          icon: "layout-dashboard",
          show: { region: "main" as const },
          webview,
        },
      ],
      statusItems: [
        {
          id: "pstdio-lab.statusStrip",
          extensionId: "pstdio.pstdio-lab",
          title: "Lab status",
          when: { mode: ["pstdio-lab.lab"] },
          webview,
        },
      ],
    };

    registerExtensionModeContributions(workbench, metadata, "project-1");
    workbench.modes.registerMode({ id: "other", activate: () => undefined });

    const statusIds = () => workbench.layout.getLayout().regions.status.widgets.map((widget) => widget.contributionId);

    expect(statusIds()).toEqual([]);

    workbench.modes.setActiveMode("pstdio-lab.lab");
    expect(statusIds()).toEqual([extensionViewWidgetId("pstdio-lab.statusStrip")]);
    expect(workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.contributionId)).toEqual([
      extensionViewWidgetId("pstdio-lab.overview"),
    ]);

    workbench.modes.setActiveMode("other");
    expect(statusIds()).toEqual([]);
  });

  test("a mode with activity items owns navigation and clears the host sidenav", () => {
    const workbench = createWorkbenchCore();
    const metadata = {
      ...emptyDashboardExtensionMetadata,
      commands: [{ id: "pstdio-lab.home", extensionId: "pstdio.pstdio-lab", title: "Home" }],
      activityItems: [
        {
          id: "pstdio-lab.home",
          extensionId: "pstdio.pstdio-lab",
          title: "Home",
          icon: "house",
          modes: ["pstdio-lab.lab"],
          commandId: "pstdio-lab.home",
        },
      ],
      modes: [
        {
          id: "pstdio-lab.lab",
          extensionId: "pstdio.pstdio-lab",
          modeId: "pstdio-lab.lab",
          label: "Lab",
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

    registerHostSidenav(workbench);
    workbench.layout.openPanel("dashboard.sidenav", { pinned: true });
    registerExtensionModeContributions(workbench, metadata, "project-1");

    workbench.modes.setActiveMode("pstdio-lab.lab");

    expect(workbench.layout.getLayout().regions.sidenav.widgets).toEqual([]);
  });
});

describe("extension-mode-layout native menus", () => {
  test("registers native-bodied panel menus of webview panels with their renderer ids", () => {
    const workbench = createWorkbenchCore();
    const metadata = {
      ...emptyDashboardExtensionMetadata,
      panels: [
        {
          id: "pstdio-lab.cams",
          extensionId: "pstdio.pstdio-lab",
          title: "Cams",
          show: { region: "main" as const },
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
          panelRegions: ["main", "secondary", "side"] as ("main" | "secondary" | "side")[],
          modePanels: { "pstdio-lab.sidenav": { region: "sidenav" as const, pinned: true, required: true } },
        },
      ],
      panels: [
        {
          id: "pstdio-lab.sidenav",
          extensionId: "pstdio.pstdio-lab",
          title: "Lab Sidenav",
          show: { region: "sidenav" as const },
          webview,
        },
      ],
    };

    registerHostSidenav(workbench);
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
