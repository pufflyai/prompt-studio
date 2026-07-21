import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench/core";
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
    expect(extensionViewRegion("workbench.main.left")).toBe("main-left-menu");
  });

  test("registers docked extension views as project-scoped Add panel widgets", () => {
    const workbench = createWorkbenchCore();
    const metadata = {
      ...emptyDashboardExtensionMetadata,
      views: [
        {
          id: "pstdio-lab.overview",
          extensionId: "pstdio.pstdio-lab",
          slotId: "workbench.main",
          title: "Lab overview",
          target: "workbench.main" as const,
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

    const widget = workbench.layout.getWidget(extensionViewWidgetId("pstdio-lab.overview"))!;
    expect(widget).toMatchObject({
      panelAddable: true,
      config: { projectId: "project-1" },
    });

    setCachedDashboardExtensionMetadata("project-1", metadata);
    try {
      const placement = workbench.layout.openWidget(widget.id, { closable: true });
      expect(resolveExtensionView({ widget, placement })?.view.id).toBe("pstdio-lab.overview");
    } finally {
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});
