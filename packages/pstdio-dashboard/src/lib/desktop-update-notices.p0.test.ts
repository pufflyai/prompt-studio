import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { connectDesktopUpdateNotices } from "./desktop-update-notices";

test("native update status goes to the active workbench and can be dismissed there", async () => {
  const workbench = createWorkbench();
  const takeUpdateNotice = async () => ({ level: "info" as const, title: "Update ready" });
  const stop = connectDesktopUpdateNotices({ onUpdateNotice: () => () => {}, takeUpdateNotice }, () => workbench);
  try {
    await Promise.resolve();
    expect(workbench.notifications.listNotifications()).toMatchObject([{ id: "desktop.update", level: "info" }]);
    workbench.notifications.dismiss("desktop.update");
    expect(workbench.notifications.listNotifications()).toEqual([]);
  } finally {
    stop?.();
    await workbench.dispose();
  }
});
