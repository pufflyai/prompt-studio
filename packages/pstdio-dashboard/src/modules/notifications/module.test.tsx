import { afterEach, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { receiveSettings } from "@/shared/settings/synced-settings";
import { createNotificationsModule } from "./module";

afterEach(() => getWriter("settings")!.remove("global"));

test("exposes the notification center only while opted in", async () => {
  const workbench = createWorkbench();
  const registration = workbench.registerModule(createNotificationsModule());
  const id = dashboardWidgetIds.notificationsModal;
  expect(workbench.overlays.getOverlay(id)).toBeUndefined();
  expect(workbench.commands.getCommand(dashboardCommandIds.openNotifications)).toBeUndefined();
  expect(() => workbench.overlays.openOverlay(id)).toThrow();
  for (let index = 0; index < 2; index++) {
    receiveSettings({ max_concurrent_sessions: null, notifications_enabled: true });
    expect(workbench.overlays.getOverlay(id)).toBeDefined();
    await workbench.commands.executeCommand(dashboardCommandIds.openNotifications);
    expect(workbench.layout.getLayout().regions.overlay.widgets).toHaveLength(1);
    receiveSettings({ max_concurrent_sessions: null, notifications_enabled: false });
    expect(workbench.layout.getLayout().regions.overlay.widgets).toHaveLength(0);
    expect(workbench.overlays.getOverlay(id)).toBeUndefined();
    expect(workbench.commands.getCommand(dashboardCommandIds.openNotifications)).toBeUndefined();
    expect(() => workbench.overlays.openOverlay(id)).toThrow();
  }
  registration.dispose();
});
