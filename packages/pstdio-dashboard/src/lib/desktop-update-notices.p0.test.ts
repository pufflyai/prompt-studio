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

test("a delayed progress response cannot replace the completed update notice", async () => {
  const workbench = createWorkbench();
  let notify = () => {};
  let reads = 0;
  const progress = Promise.withResolvers<{ kind: "progress"; title: string }>();
  const ready = { level: "info" as const, title: "Update ready" };
  const stop = connectDesktopUpdateNotices(
    {
      onUpdateNotice(listener: () => void) {
        notify = listener;
        return () => {};
      },
      takeUpdateNotice() {
        reads += 1;
        return reads === 1 ? progress.promise : Promise.resolve({ kind: "progress", title: null, outcome: ready });
      },
    },
    () => workbench,
  );
  try {
    notify();
    expect(reads).toBe(1);
    progress.resolve({ kind: "progress", title: "Checking for updates" });
    await Promise.resolve();
    await Promise.resolve();
    expect(reads).toBe(2);
    expect(workbench.notifications.listNotifications()).toMatchObject([ready]);
  } finally {
    stop?.();
    await workbench.dispose();
  }
});

test("a native check that hands off to the browser clears its progress", async () => {
  const workbench = createWorkbench();
  let notify = () => {};
  const installed = { level: "info" as const, title: "Update installed" };
  let notice: { kind: "progress"; title: string | null; outcome?: typeof installed } = {
    kind: "progress",
    title: "Checking for updates",
    outcome: installed,
  };
  const stop = connectDesktopUpdateNotices(
    {
      onUpdateNotice(listener: () => void) {
        notify = listener;
        return () => {};
      },
      takeUpdateNotice: async () => notice,
    },
    () => workbench,
  );
  try {
    await Promise.resolve();
    expect(workbench.notifications.listNotifications()).toHaveLength(2);
    notice = { kind: "progress", title: null };
    notify();
    await Promise.resolve();
    expect(workbench.notifications.listNotifications()).toMatchObject([installed]);
  } finally {
    stop?.();
    await workbench.dispose();
  }
});
