import { describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { receiveSettings } from "@/shared/settings/synced-settings";
import { createNotificationsModule, DASHBOARD_NOTIFICATIONS_KEYBINDING } from "./module";

describe("createNotificationsModule", () => {
  test("registers a shortcut for opening notifications", () => {
    receiveSettings({ notifications_enabled: true, max_concurrent_sessions: null });
    const workbench = createWorkbench();
    const module = workbench.registerModule(createNotificationsModule());

    try {
      expect(workbench.keybindings.listKeybindings()).toContainEqual(
        expect.objectContaining({
          action: { kind: "command", commandId: dashboardCommandIds.openNotifications },
          keybinding: DASHBOARD_NOTIFICATIONS_KEYBINDING,
          when: "!inputFocus",
        }),
      );
    } finally {
      module.dispose();
      getWriter("settings")!.remove("global");
    }
  });
});
