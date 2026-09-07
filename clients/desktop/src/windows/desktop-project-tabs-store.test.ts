import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DesktopProjectTabsStore } from "./desktop-project-tabs-store";

const homes: string[] = [];
const createPath = () => {
  const home = mkdtempSync(join(tmpdir(), "desktop-project-tabs-"));
  homes.push(home);
  return join(home, "project-tabs.json");
};
afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

test("restores only ordered project IDs across store instances", async () => {
  const path = createPath();
  const store = new DesktopProjectTabsStore(path);
  expect(await store.getProjectTabs()).toEqual({ projectIds: [] });
  await store.setProjectTabs({ projectIds: ["second", "first"] });
  expect(await new DesktopProjectTabsStore(path).getProjectTabs()).toEqual({ projectIds: ["second", "first"] });
  expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ projectIds: ["second", "first"] });
});

test("serializes rapid writes in the order they were requested", async () => {
  const path = createPath();
  const store = new DesktopProjectTabsStore(path);
  await Promise.all([
    store.setProjectTabs({ projectIds: ["first"] }),
    store.setProjectTabs({ projectIds: ["first", "second"] }),
    store.setProjectTabs({ projectIds: ["second"] }),
  ]);
  expect(await new DesktopProjectTabsStore(path).getProjectTabs()).toEqual({ projectIds: ["second"] });
});

test("treats corrupt or invalid persisted state as an empty list", async () => {
  const path = createPath();
  for (const value of ["{", "null", '{"projectIds":[42]}', '{"projectIds":["a","a"]}']) {
    writeFileSync(path, value);
    expect(await new DesktopProjectTabsStore(path).getProjectTabs()).toEqual({ projectIds: [] });
  }
});

test("rejects invalid updates without replacing the saved tabs", async () => {
  const path = createPath();
  const store = new DesktopProjectTabsStore(path);
  await store.setProjectTabs({ projectIds: ["first"] });
  await expect(store.setProjectTabs({ projectIds: ["first", "first"] })).rejects.toThrow("Invalid project tabs");
  await expect(store.setProjectTabs({ projectIds: [""] })).rejects.toThrow("Invalid project tabs");
  expect(await store.getProjectTabs()).toEqual({ projectIds: ["first"] });
});
