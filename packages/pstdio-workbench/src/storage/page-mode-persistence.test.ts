import { expect, test } from "bun:test";
import type { PageLocation } from "@pstdio/sdk/extensions";
import { createLocalStoragePageLocationPersistence } from "./local-storage-persistence";

test("restores each mode's remembered page after a browser reload", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  const first = createLocalStoragePageLocationPersistence({ namespace: "mode-pages", storage });
  const location: PageLocation = { page: { kind: "page", id: "library" }, mode: { kind: "mode", id: "boombox" } };
  first.save("p1", { location, modeLocations: { boombox: location } });
  const reloaded = createLocalStoragePageLocationPersistence({ namespace: "mode-pages", storage });
  expect(reloaded.load("p1")?.modeLocations).toEqual({ boombox: location });
});
