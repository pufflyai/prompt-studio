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
