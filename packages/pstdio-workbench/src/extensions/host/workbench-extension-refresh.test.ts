import { describe, expect, spyOn, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore, type WorkbenchModuleContribution } from "../../core";
import {
  registerWorkbenchExtensionRendererRefreshEvents,
  type WorkbenchExtensionRefreshEvent,
} from "./workbench-extension-refresh";

const metadata = {
  extensions: [],
  commands: [],
  menuContributions: [],
  commandPaletteContributions: [],
  modes: [],
  pages: [],
  views: [
    {
      id: "pstdio.lab.view.outline",
      localId: "outline",
      extensionId: "pstdio.lab",
      title: "Outline",
      body: {
        kind: "tree",
        bodyHandlerId: "pstdio.lab.view.outline.tree.body",
        refreshEventIds: ["pstdio.lab.event.outline.changed"],
      },
    },
  ],
  viewMenus: [],
  placements: [],
  resourceKinds: [],
  resourceViews: [],
  navigationItems: [],
  statusBarItems: [],
  statuses: [],
  settingsPanels: [],
  diagnostics: [],
} satisfies WorkbenchExtensionMetadata;

describe("registerWorkbenchExtensionRendererRefreshEvents", () => {
  test("refreshes the native renderer owned by an alpha.4 view", () => {
    const workbench = createWorkbenchCore();
    let listener: ((event: WorkbenchExtensionRefreshEvent) => void) | undefined;
    const refresh = spyOn(workbench.renderers, "refresh");
    const module: WorkbenchModuleContribution = {
      id: "test.extension-refresh",
      activate(ctx) {
        ctx.renderers.registerTreeRenderer({
          id: "pstdio.lab.view.outline",
          title: "Outline",
          getBody: () => [],
          getChildren: () => [],
        });
        return registerWorkbenchExtensionRendererRefreshEvents({
          metadata,
          subscribe: (next) => {
            listener = next;
            return { dispose: () => undefined };
          },
          workbench: ctx,
        });
      },
    };

    workbench.registerModule(module);
    listener?.({ id: "pstdio.lab.event.outline.changed" });

    expect(refresh).toHaveBeenCalledWith("pstdio.lab.view.outline");
  });
});
