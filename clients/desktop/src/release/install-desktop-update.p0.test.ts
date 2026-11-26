import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { installDesktopUpdate } from "./install-desktop-update";

test.each(["throws", "emits asynchronously"])("reports an installer failure that %s", async (mode) => {
  const failure = new Error("Installer could not restart");
  const reported = Promise.withResolvers<unknown>();
  const updater = Object.assign(new EventEmitter(), {
    quitAndInstall() {
      if (mode === "throws") throw failure;
      queueMicrotask(() => updater.emit("error", failure));
    },
  });

  installDesktopUpdate(updater, reported.resolve);
  expect(await reported.promise).toBe(failure);
  expect(updater.listenerCount("error")).toBe(0);
});
