import type { ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { type Browser, chromium, expect, test } from "../scripts/playwright-test";
import { signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

test("packaged Main fullscreen exits with Escape and resets on reload", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-main-fullscreen-"));
  let child: ChildProcess | null = null;
  let browser: Browser | null = null;
  try {
    const defaults = JSON.parse(e2eExtensions("workbench-fixture"));
    defaults.defaultExtensions[0].force = true;
    const started = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify(defaults) });
    child = started.child;
    browser = await chromium.launch();
    const page = await browser.newPage();
    await signInBrowser(page, started.descriptor);
    const picker = page.getByRole("dialog", { name: "Projects", exact: true });
    await expect(picker.getByText("No projects yet", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enter Main fullscreen", exact: true })).toBeHidden();
    await expect(page.locator('[data-workbench-region="status"]')).toBeHidden();
    for (const button of await page.locator("#root button").all()) {
      await expect(button).toBeHidden();
    }
    await picker.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByRole("option", { name: "Appearance", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /^Close/ }).click();
    await expect(picker).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(picker).toBeVisible();
    await picker.getByRole("button", { name: "Create project", exact: true }).click();
    await page.getByRole("button", { name: "Close Create project", exact: true }).click();
    await expect(picker).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("empty-project-selection.png") });

    const installedRoot = join(root, "extensions", "workbench-fixture");
    await expect.poll(() => existsSync(join(installedRoot, "package.json"))).toBe(true);
    const installedNote = join(installedRoot, "local-note.txt");
    writeFileSync(installedNote, "Keep the installed source");
    await picker.getByRole("button", { name: "Create project", exact: true }).click();
    const path = page.getByRole("textbox", { name: "Folder path", exact: true });
    await path.fill(folderProjectInput({}).initial_workspace.params.path);
    await path.press("Enter");
    const created = page.waitForResponse(
      (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/v1/projects",
    );
    await page.getByRole("button", { name: "Open folder", exact: true }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    expect(readFileSync(installedNote, "utf8")).toBe("Keep the installed source");
    const project = (await response.json()) as { id: string };
    await expect(page.getByRole("option", { name: "Home", exact: true })).toBeVisible();
    await expect(page.getByTestId("start-page")).toBeVisible();
    const enter = page.getByRole("button", { name: "Enter Main fullscreen", exact: true });
    await enter.click();
    await expect(page.getByRole("button", { name: "Exit Main fullscreen", exact: true })).toBeVisible();
    const bubble = page.getByRole("button", { name: "Open Side Panel", exact: true });
    await expect(bubble).toBeVisible();
    await bubble.click();
    await expect(page.getByRole("dialog", { name: "Side Panel", exact: true })).toBeVisible();
    await expect(bubble).toBeHidden();
    await page.getByRole("button", { name: "Close Side Panel", exact: true }).click();
    await expect(bubble).toBeVisible();
    await expect(bubble).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Side Panel", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close Side Panel", exact: true }).click();
    await expect(bubble).toBeVisible();
    await page.getByText("Project home", { exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(enter).toBeFocused();
    await enter.click();
    await page.reload();
    await expect(enter).toBeVisible();
    await page.goto(`${started.baseUrl}/projects/${project.id}/extensions/pstdio.workbench-fixture/lab`);
    const guest = page.frameLocator('iframe[title="Lab"]');
    await expect(guest.getByRole("heading", { name: "Sandbox webview", exact: true })).toBeVisible();
    await guest.locator("body").press("Alt+Shift+Space");
    await expect(page.getByRole("dialog", { name: "Keyboard menu", exact: true })).toBeVisible();
    await page.keyboard.press("V");
    await expect(page.getByRole("dialog", { name: "Keyboard menu / View", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Keyboard menu", exact: true })).toBeHidden();
    await expect(page.locator('iframe[title="Lab"]')).toBeFocused();
    await enter.click();
    await guest.locator("body").press("Escape");
    await expect(enter).toBeVisible();
  } finally {
    await browser?.close();
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
