import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

test("the artifact list fills empty Main and returns after closing an artifact", async ({ page, request }) => {
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
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await page.goto(`/projects/${project.id}/extensions/pstdio.pstdio-artifacts/artifacts`);
    const main = page.locator('[data-workbench-panel="main"]');
    const library = main.frameLocator('iframe[title="Artifacts"]:visible');
    await expect(library.getByRole("button", { name: "Project brief", exact: true })).toBeVisible();
    await expect(main.getByRole("tab", { includeHidden: true })).toHaveCount(0);
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
    await expect(main.getByRole("tab")).toHaveCount(1);
    const preview = library.frameLocator('iframe[title="Preview: Placeholder example"]').frameLocator("iframe");
    await expect(preview.getByRole("heading", { name: "Example content" })).toBeVisible();
    await tab.getByRole("button", { name: "Close Placeholder example", exact: true }).click();
    await expect(library.getByRole("button", { name: "Placeholder example", exact: true })).toBeVisible();
    await expect(main.getByRole("tab", { includeHidden: true })).toHaveCount(0);
    await page.reload();
    await expect(library.getByRole("button", { name: "Placeholder example", exact: true })).toBeVisible();
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${project.id}`);
    rmSync(folder, { recursive: true, force: true });
  }
});
