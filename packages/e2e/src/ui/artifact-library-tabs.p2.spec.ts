import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

test("the artifact library moves between panels and remains a singleton", async ({ page, request }) => {
  test.setTimeout(45_000);
  const tempRoot = resolve(import.meta.dirname, "../../../../__test-tmp__");
  mkdirSync(tempRoot, { recursive: true });
  const folder = mkdtempSync(join(tempRoot, "artifact-placeholder-"));
  execFileSync("git", ["init", "--quiet", folder]);
  const response = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Artifact placeholder" }, folder),
  });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  try {
    await page.addInitScript(() => {
      if (window === window.top) localStorage.setItem("onboarding-complete", "true");
    });
    await page.goto(`/projects/${project.id}/extensions/pstdio.pstdio-artifacts/artifacts`);
    const main = page.locator('[data-workbench-panel="main"]');
    const library = main.frameLocator('iframe[title="Artifacts"]:visible');
    await expect(library.getByRole("button", { name: "Project brief", exact: true })).toBeVisible();
    const libraryTab = main.getByRole("tab", { name: "Artifacts", exact: true });
    await expect(libraryTab).toBeVisible();
    await expect(main.getByRole("tab")).toHaveCount(1);
    await libraryTab.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Unpin tab", exact: true }).click();
    await libraryTab.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Pin tab", exact: true }).click();
    await main.getByRole("button", { name: "Add panel", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Artifacts", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await libraryTab.click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: "Move to Secondary", exact: true })).toBeVisible();
    await page.getByRole("menuitem", { name: "Move to Side", exact: true }).click();
    const side = page.locator('[data-workbench-panel="side"]:visible');
    const sideTab = side.getByRole("tab", { name: "Artifacts", exact: true });
    await expect(sideTab).toBeVisible();
    const tabId = await sideTab.locator("..").getAttribute("data-workbench-tab");
    const card = main
      .getByRole("group", { name: "Available tabs" })
      .getByRole("button", { name: "Artifacts", exact: true });
    await expect(card).toHaveCount(0);
    await sideTab.hover();
    const bounds = (await sideTab.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2 + 12, bounds.y + bounds.height / 2, { steps: 3 });
    await page.locator('[data-workbench-edge-hit="secondary"][data-workbench-edge-position="bottom"]').hover();
    await expect(page.locator('[data-workbench-edge-drop="secondary"]')).toBeVisible();
    await page.mouse.up();
    const bottom = page.locator('[data-workbench-panel="secondary"]:visible');
    const bottomTab = bottom.getByRole("tab", { name: "Artifacts", exact: true });
    await expect(bottomTab).toBeVisible();
    await expect(bottomTab.locator("..")).toHaveAttribute("data-workbench-tab", tabId!);
    await page.reload();
    await expect(bottomTab).toBeVisible();
    await expect(page.getByRole("tab", { name: "Artifacts", exact: true })).toHaveCount(1);
    await bottomTab.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Move to Main", exact: true }).click();
    await expect(libraryTab).toBeVisible();
    writeFileSync(join(folder, "page.html"), "<title>Placeholder example</title><h1>Example content</h1>");
    const published = await request.post(
      `${uiOrigin}/v1/projects/${project.id}/extensions/commands/pstdio.pstdio-artifacts.command.publish/execute`,
      { data: { params: { file_path: "page.html" }, source: "api" } },
    );
    expect(published.ok()).toBe(true);
    expect((await published.json()).outcome.status).toBe("success");
    await library.getByRole("button", { name: "Placeholder example", exact: true }).click();
    const tab = main.getByRole("tab", { name: "Placeholder example", exact: true });
    await expect(tab).toBeVisible();
    await expect(main.getByRole("tab")).toHaveCount(2);
    const preview = library.frameLocator('iframe[title="Preview: Placeholder example"]').frameLocator("iframe");
    await expect(preview.getByRole("heading", { name: "Example content" })).toBeVisible();
    await libraryTab.click();
    await expect(library.getByRole("button", { name: "Placeholder example", exact: true })).toBeVisible();
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await page.getByRole("option", { name: "Artifacts", exact: true }).click();
    await expect(libraryTab).toHaveCount(1);
    await expect(libraryTab).toHaveAttribute("aria-selected", "true");
    await tab.click();
    await tab.getByRole("button", { name: "Close Placeholder example", exact: true }).click();
    await libraryTab.getByRole("button", { name: "Close Artifacts", exact: true }).click();
    await expect(main.getByRole("tab", { includeHidden: true })).toHaveCount(0);
    await expect(card).toBeVisible();
    await page.getByRole("button", { name: "Show Side Panel", exact: true }).click();
    await page.getByRole("button", { name: "Show Bottom Panel", exact: true }).click();
    await expect(side.getByRole("group", { name: "Available tabs" })).toBeVisible();
    await expect(side.getByRole("button", { name: "Artifacts", exact: true })).toHaveCount(0);
    await side.getByRole("button", { name: "Add panel", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Artifacts", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(bottom.getByRole("button", { name: "Artifacts", exact: true })).toHaveCount(0);
    await bottom.getByRole("button", { name: "Add panel", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Artifacts", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await card.click();
    await expect(libraryTab).toBeVisible();
    await libraryTab.getByRole("button", { name: "Close Artifacts", exact: true }).click();
    await main.getByRole("button", { name: "Add panel", exact: true }).click();
    await page.getByRole("menuitem", { name: "Artifacts", exact: true }).click();
    await expect(libraryTab).toBeVisible();
    await expect(main.getByRole("tab")).toHaveCount(1);
    await expect(library.getByRole("button", { name: "Placeholder example", exact: true })).toBeVisible();
    await page.reload();
    await expect(libraryTab).toHaveCount(1);
    await expect(library.getByRole("button", { name: "Placeholder example", exact: true })).toBeVisible();
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${project.id}`);
    rmSync(folder, { recursive: true, force: true });
  }
});
