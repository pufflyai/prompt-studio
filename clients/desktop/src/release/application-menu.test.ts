import { describe, expect, test } from "bun:test";
import { createApplicationMenuTemplate } from "./application-menu";

const findUpdateItem = (platform: NodeJS.Platform, checkForUpdates: () => void) => {
  const template = createApplicationMenuTemplate(platform, checkForUpdates);
  const menu = template.find((item) => item.label === (platform === "darwin" ? "Prompt Studio" : "Help"));
  return Array.isArray(menu?.submenu)
    ? menu.submenu.find((item) => typeof item === "object" && item.label === "Check for Updates…")
    : undefined;
};

describe("desktop application menu", () => {
  test.each(["darwin", "win32", "linux"] as NodeJS.Platform[])("exposes the update action on %s", (platform) => {
    let checks = 0;
    const item = findUpdateItem(platform, () => checks++);

    expect(item).toBeDefined();
    if (item && typeof item === "object") item.click?.({} as never, {} as never, {} as never);
    expect(checks).toBe(1);
  });
});
