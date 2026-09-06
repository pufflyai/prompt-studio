import { describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { createNotificationsModule, DASHBOARD_NOTIFICATIONS_KEYBINDING } from "./module";

describe("createNotificationsModule", () => {
  test("registers a shortcut for opening notifications", () => {
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
    }
  });
});
