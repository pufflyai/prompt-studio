import { expect, test } from "bun:test";
import { createDesktopUpdateNotifications } from "./desktop-update-notifications";

test("an update completed before the workbench connects stays available without opening a dialog", () => {
  const recorded: string[] = [];
  let changed = 0;
  const notifications = createDesktopUpdateNotifications({
    currentVersion: "1.0.0",
    receipt: {
      recordDownload: (version) => {
        recorded.push(version);
      },
      consumeInstalled: () => false,
    },
    onNotice: () => changed++,
    logError: () => {},
  });
  notifications.downloaded("2.0.0");
  expect(recorded).toEqual(["2.0.0"]);
  expect(changed).toBe(1);
  const ready = { kind: "progress", upgrade: { version: "2.0.0", ready: true, prompt: false } };
  expect(notifications.take({ version: "2.0.0", ready: true })).toMatchObject(ready);
  expect(notifications.take({ version: "2.0.0", ready: true })).toMatchObject(ready);
});

test("completed native results replace progress and survive its cleanup", () => {
  const notifications = createDesktopUpdateNotifications({
    currentVersion: "1.0.0",
    receipt: { recordDownload: () => {}, consumeInstalled: () => false },
    onNotice: () => {},
    logError: () => {},
  });
  notifications.progress("checking");
  expect(notifications.take()).toMatchObject({ kind: "progress", title: expect.any(String) });
  notifications.progress("downloading");
  notifications.upgradeChanged(true);
  notifications.downloaded("2.0.0");
  notifications.progress(undefined);
  expect(notifications.take({ version: "2.0.0", ready: true })).toMatchObject({
    kind: "progress",
    title: null,
    upgrade: { version: "2.0.0", ready: true, prompt: true },
  });
  expect(notifications.take({ version: "2.0.0", ready: true })).toMatchObject({
    upgrade: { version: "2.0.0", ready: true, prompt: false },
  });

  notifications.progress("checking");
  expect(notifications.take()).toBeDefined();
  notifications.progress(undefined);
  expect(notifications.take()).toEqual({ kind: "progress", title: null });
});

test("an interactive check keeps an unread installed update notice", () => {
  const notifications = createDesktopUpdateNotifications({
    currentVersion: "2.0.0",
    receipt: { recordDownload: () => {}, consumeInstalled: () => true },
    onNotice: () => {},
    logError: () => {},
  });
  notifications.installed();
  notifications.progress("checking");
  const checking = notifications.take();
  expect(checking).toMatchObject({
    kind: "progress",
    title: expect.any(String),
    installed: { level: "info", message: expect.stringContaining("2.0.0") },
  });

  notifications.progress(undefined);
  expect(notifications.take()).toEqual({ kind: "progress", title: null });
});

test("installation and check outcomes both survive a fast check before the workbench connects", () => {
  const notifications = createDesktopUpdateNotifications({
    currentVersion: "2.0.0",
    receipt: { recordDownload: () => {}, consumeInstalled: () => true },
    onNotice: () => {},
    logError: () => {},
  });
  notifications.installed();
  notifications.progress("checking");
  notifications.notAvailable();
  expect(notifications.take()).toMatchObject({
    kind: "progress",
    title: null,
    installed: { message: expect.stringContaining("2.0.0") },
    outcome: { level: "info" },
  });
  expect(notifications.take()).toBeUndefined();
});
