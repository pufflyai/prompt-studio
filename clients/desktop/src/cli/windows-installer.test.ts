import { expect, test } from "bun:test";
import { windowsInstallerEvent } from "./windows-installer";

test("handles Windows installation, update, removal, and obsolete events before desktop startup", () => {
  for (const event of ["install", "updated", "uninstall", "obsolete"]) {
    expect(windowsInstallerEvent("win32", ["Prompt Studio.exe", `--squirrel-${event}`, "1.0.0"])).toBe(event);
  }
});

test("opens the desktop normally on first run and outside Windows installer events", () => {
  expect(windowsInstallerEvent("win32", ["Prompt Studio.exe", "--squirrel-firstrun"])).toBeNull();
  expect(windowsInstallerEvent("win32", ["Prompt Studio.exe"])).toBeNull();
  expect(windowsInstallerEvent("darwin", ["Prompt Studio", "--squirrel-install"])).toBeNull();
});
