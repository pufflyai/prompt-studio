import { describe, expect, spyOn, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { receiveSettings } from "@/shared/settings/synced-settings";
import { createNotificationsModule, DASHBOARD_NOTIFICATIONS_KEYBINDING } from "./module";

describe("createNotificationsModule", () => {
  test("foreign notification changes do not refresh the selected project navigation", async () => {
    receiveSettings({ notifications_enabled: true, machine_tokens_enabled: false, max_concurrent_sessions: null });
    const workbench = createWorkbench();
    selectDashboardProject(workbench, { id: "selected", name: "Selected" });
    const view = workbench.views.registerView({
      id: dashboardWidgetIds.dashboardSidenav,
      title: "Navigation",
      body: { kind: "react", render: () => null },
    });
    const module = createNotificationsModule();
    let refresh = () => 0;
    const registration = workbench.registerModule({
      ...module,
      activate(ctx) {
        const observation = spyOn(ctx.views, "refreshView");
        refresh = () => observation.mock.calls.length;
        return [...module.activate(ctx), { dispose: () => observation.mockRestore() }];
      },
    });
    const baseline = refresh();
    const writer = getWriter("notifications")!;
    try {
      writer.upsert({ id: "foreign", project_id: "foreign", status: "open" });
      await Bun.sleep(0);
      expect(refresh()).toBe(baseline);
      writer.upsert({ id: "selected", project_id: "selected", status: "open" });
      await Bun.sleep(0);
      expect(refresh()).toBe(baseline + 1);
      writer.upsert({ id: "selected", project_id: "selected", status: "open", body: "New body" });
      await Bun.sleep(0);
      expect(refresh()).toBe(baseline + 1);
    } finally {
      registration.dispose();
      view.dispose();
      writer.remove("foreign");
      writer.remove("selected");
      getWriter("settings")!.remove("global");
      await workbench.dispose();
    }
  });
  test("registers a shortcut for opening notifications", () => {
    receiveSettings({ notifications_enabled: true, machine_tokens_enabled: false, max_concurrent_sessions: null });
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
