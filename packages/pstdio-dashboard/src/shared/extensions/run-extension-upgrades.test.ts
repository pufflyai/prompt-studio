import { expect, test } from "bun:test";
import type { ProjectExtensionInstance } from "@pstdio/sdk/api";
import { runExtensionUpgrades } from "./run-extension-upgrades";

const extension = (id: string, overrides: Partial<ProjectExtensionInstance> = {}) =>
  ({ id, displayName: id, canUpgrade: true, ...overrides }) as ProjectExtensionInstance;

test("bulk upgrades distinguish changed, current, protected, and failed extensions", async () => {
  const extensions = [
    extension("upgraded"),
    extension("current"),
    extension("local", { canUpgrade: false, upgradeBlockedReason: "local_source" }),
    extension("failed"),
  ];
  const called: string[] = [];
  const settled: string[] = [];
  const result = await runExtensionUpgrades(
    extensions,
    async (entry) => {
      called.push(entry.id);
      if (entry.id === "failed") throw new Error("Download failed");
      return { changed: entry.id !== "current", extension: entry };
    },
    (entry) => settled.push(entry.id),
  );
  expect(called).toEqual(["upgraded", "current", "failed"]);
  expect(settled).toEqual(called);
  expect(result.upgraded.map(({ id }) => id)).toEqual(["upgraded"]);
  expect(result.current.map(({ id }) => id)).toEqual(["current"]);
  expect(result.skipped.map(({ id }) => id)).toEqual(["local"]);
  expect(result.failed).toEqual(["failed: Download failed"]);
});
