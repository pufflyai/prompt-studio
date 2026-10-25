import { expect, test } from "bun:test";
import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { createConnectionStatusSettings } from "./connection-status-settings";

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  } satisfies WorkbenchStorageLike;
};

test("connection status is hidden until enabled on this device", () => {
  const storage = createStorage();
  const settings = createConnectionStatusSettings(storage);
  expect(settings.getEnabled()).toBe(false);
  let notifications = 0;
  const stop = settings.subscribe(() => {
    notifications += 1;
  });

  settings.setEnabled(true);
  expect(settings.getEnabled()).toBe(true);
  expect(createConnectionStatusSettings(storage).getEnabled()).toBe(true);
  expect(createConnectionStatusSettings(createStorage()).getEnabled()).toBe(false);
  settings.setEnabled(false);
  expect(createConnectionStatusSettings(storage).getEnabled()).toBe(false);
  expect(notifications).toBe(2);
  stop();
  settings.setEnabled(true);
  expect(notifications).toBe(2);
});

test("a failed save keeps the previous connection status preference", () => {
  const settings = createConnectionStatusSettings({
    getItem: () => null,
    setItem: () => {
      throw new Error("Storage is full");
    },
  });
  expect(() => settings.setEnabled(true)).toThrow("Storage is full");
  expect(settings.getEnabled()).toBe(false);
});
