import { expect, test } from "bun:test";
import { createDesktopUpdateNotifications } from "./desktop-update-notifications";

test("an update completed before the workbench connects is delivered once", () => {
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
  expect(notifications.take()).toMatchObject({ level: "info", message: expect.stringContaining("2.0.0") });
  expect(notifications.take()).toBeUndefined();
});
