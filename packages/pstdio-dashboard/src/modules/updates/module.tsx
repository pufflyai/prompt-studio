import type { Disposable, WorkbenchModuleContribution } from "@pstdio/workbench";
import { UpdateChannelPanel } from "./components/update-channel-panel";
import { hasUpdateChannelBridge } from "./update-channel-bridge";

const SETTINGS_PANEL_ID = "update-channel";
const SETTINGS_VIEW_ID = "dashboard.settings.update-channel";

// The Update channel setting under Developer tools. It appears only in desktop
// builds that can switch channel, which the desktop reports asynchronously.
export const createUpdatesModule = (
  bridge: unknown = (globalThis as { promptStudioDesktop?: unknown }).promptStudioDesktop,
) =>
  ({
    id: "dashboard.updates",
    activate(ctx) {
      if (!hasUpdateChannelBridge(bridge)) return undefined;

      let disposed = false;
      let registered: Disposable[] = [];
      void bridge
        .getUpdateChannel()
        .then((channel) => {
          if (disposed || channel === null) return;
          registered = [
            ctx.views.registerView({
              id: SETTINGS_VIEW_ID,
              title: "Update channel",
              body: { kind: "react", render: () => <UpdateChannelPanel bridge={bridge} /> },
            }),
            ctx.settings.registerPanel({
              kind: "view",
              id: SETTINGS_PANEL_ID,
              title: "Update channel",
              section: "developer-tools",
              scope: "global",
              order: 15,
              icon: "CloudDownload",
              viewId: SETTINGS_VIEW_ID,
            }),
          ];
        })
        // Without a known channel there is nothing to choose, so the panel stays hidden.
        .catch(() => {});

      return {
        dispose: () => {
          disposed = true;
          for (const disposable of registered) disposable.dispose();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;
