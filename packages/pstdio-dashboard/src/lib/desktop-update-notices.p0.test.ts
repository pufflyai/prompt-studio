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

test("an unread update follows the active project until dismissed", async () => {
  const picker = createWorkbench();
  const project = createWorkbench();
  const anotherProject = createWorkbench();
  let active = picker;
  let activeChanged: () => void = () => {};
  const stop = connectDesktopUpdateNotices(
    {
      onUpdateNotice: () => () => {},
      takeUpdateNotice: async () => ({ level: "info", title: "Restart to install" }),
    },
    () => active,
    (listener: () => void) => {
      activeChanged = listener;
      return () => {};
    },
  );
  try {
    await Promise.resolve();
    expect(picker.notifications.listNotifications()).toHaveLength(1);
    active = project;
    activeChanged();
    await picker.dispose();
    expect(project.notifications.listNotifications()).toMatchObject([{ title: "Restart to install" }]);
    project.notifications.dismiss("desktop.update");
    active = anotherProject;
    activeChanged();
    expect(active.notifications.listNotifications()).toEqual([]);
  } finally {
    stop?.();
    await Promise.all([picker.dispose(), project.dispose(), anotherProject.dispose()]);
  }
});
