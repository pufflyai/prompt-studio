import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import {
  clearCachedDashboardExtensionMetadata,
  emptyDashboardExtensionMetadata,
  setCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { resolveExtensionView } from "./components/extension-view-widget";
import { extensionViewRegion, registerExtensionModeContributions } from "./extension-mode-layout";
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
});
