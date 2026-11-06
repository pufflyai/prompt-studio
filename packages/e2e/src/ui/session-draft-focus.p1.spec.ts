import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

// Critical: opening a new session must accept keyboard input without an extra click.
test("new session tabs focus their composer and keep workspace selection available", async ({ page, request }) => {
  const parent = fileURLToPath(new URL("../../__test-tmp__/", import.meta.url));
  mkdirSync(parent, { recursive: true });
  const folder = mkdtempSync(join(parent, "session-focus-"));
  let projectId: string | undefined;
  try {
    const created = await request.post(`${uiOrigin}/v1/projects`, {
      data: folderProjectInput({ name: "New session focus" }, folder),
    });
    expect(created.ok()).toBe(true);
    projectId = (await created.json()).id;
    await page.addInitScript(() => {
      if (window === window.top) localStorage.setItem("onboarding-complete", "true");
    });
    await page.goto(`/projects/${projectId}/sessions`);
    const main = page.locator('[data-workbench-panel="main"]');
    const mainInput = main.locator('[data-testid="content-editable"][contenteditable="true"]');
    await expect(mainInput).toBeFocused();
    await page.keyboard.type("Main session draft");
    await expect(mainInput).toHaveText("Main session draft");
    await expect(main.getByRole("button", { name: "Select workspace", exact: true })).toBeEnabled();
    await expect(main.getByRole("button", { name: "Open workspace", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Open Side Panel", exact: true }).click();
    const side = page.locator('[data-workbench-panel="side"]');
    await expect(side.locator('[data-testid="content-editable"][contenteditable="true"]')).toBeFocused();
    const header = page.locator('[data-workbench-panel-header="side"]');
    await header.getByRole("button", { name: "Add panel", exact: true }).click();
    await page.getByRole("menuitem", { name: "New session", exact: true }).click();
    const sideInput = side.locator('[data-testid="content-editable"][contenteditable="true"]:visible');
    await expect(sideInput).toBeFocused();
    await page.keyboard.type("New tab draft");
    await expect(sideInput).toHaveText("New tab draft");
    await expect(mainInput).toHaveText("Main session draft");
    await expect(side.getByRole("button", { name: "Select workspace", exact: true })).toBeEnabled();
    await expect(side.getByRole("button", { name: "Open workspace", exact: true })).toHaveCount(0);

    await header.getByRole("button", { name: "Add panel", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "New session", exact: true })).toHaveAttribute(
      "data-highlighted",
      "",
    );
    await page.keyboard.press("Enter");
    await expect(sideInput).toBeFocused();
    await page.keyboard.type("Keyboard-created draft");
    await expect(sideInput).toHaveText("Keyboard-created draft");
    await expect(mainInput).toHaveText("Main session draft");
  } finally {
    try {
      if (projectId) await request.delete(`${uiOrigin}/v1/projects/${projectId}`);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }
});
