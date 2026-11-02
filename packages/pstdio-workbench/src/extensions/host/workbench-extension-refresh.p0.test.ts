import { describe, expect, spyOn, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbench, type WorkbenchModuleContribution } from "../../core";
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
  navigationItems: [],
  navigationTrees: [],
  statusBarItems: [],
  settingsPanels: [],
  diagnostics: [],
} satisfies WorkbenchExtensionMetadata;

describe("registerWorkbenchExtensionRendererRefreshEvents", () => {
  test("refreshes the native renderer owned by an alpha.4 view", () => {
    const workbench = createWorkbench();
    let listener: ((event: WorkbenchExtensionRefreshEvent) => void) | undefined;
    const refresh = spyOn(workbench.views, "refreshView");
    const module: WorkbenchModuleContribution = {
      id: "test.extension-refresh",
      activate(ctx) {
        ctx.views.registerView({
          id: "pstdio.lab.view.outline",
          title: "Outline",
          body: { kind: "tree", getBody: () => [], getChildren: () => [] },
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

    expect(refresh).toHaveBeenCalledWith("pstdio.lab.view.outline", undefined);
  });

  test("an open palette lists a provider's results again when an event it declares arrives", () => {
    const workbench = createWorkbench();
    let listener: ((event: WorkbenchExtensionRefreshEvent) => void) | undefined;
    const module: WorkbenchModuleContribution = {
      id: "test.extension-palette-refresh",
      activate(ctx) {
        return registerWorkbenchExtensionRendererRefreshEvents({
          metadata: {
            ...metadata,
            commandPaletteResources: [
              {
                id: "pstdio.lab.resource.notes",
                extensionId: "pstdio.lab",
                title: "Notes",
                queryHandlerId: "pstdio.lab.resource.notes.query",
                refreshEventIds: ["pstdio.lab.event.notes.changed"],
              },
            ],
          },
          subscribe: (next) => {
            listener = next;
            return { dispose: () => undefined };
          },
          workbench: ctx,
        });
      },
    };

    workbench.registerModule(module);
    const before = workbench.commandPaletteResources.store.getState().refreshToken;
    listener?.({ id: "pstdio.lab.event.unrelated" });
    expect(workbench.commandPaletteResources.store.getState().refreshToken).toBe(before);
    listener?.({ id: "pstdio.lab.event.notes.changed" });
    expect(workbench.commandPaletteResources.store.getState().refreshToken).toBe(before + 1);
  });
});
