import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

const repoRoot = resolve(import.meta.dirname, "../../../..");

test("native view actions load dependent options and submit explicit values", async ({ page, request }, testInfo) => {
  const parent = join(repoRoot, "__test-tmp__");
  mkdirSync(parent, { recursive: true });
  const sourcePath = mkdtempSync(join(parent, "native-actions-"));
  execFileSync("bun", [
    "build",
    join(import.meta.dirname, "../fixtures/native-view-actions/extension.ts"),
    "--target=bun",
    "--outfile",
    join(sourcePath, "extension.ts"),
  ]);
  writeFileSync(
    join(sourcePath, "package.json"),
    JSON.stringify({
      name: "native-actions",
      publisher: "e2e",
      version: "0.1.0",
      main: "extension.ts",
      type: "module",
      engines: { pstdio: "1.0.0-alpha.14" },
    }),
  );
  const projectPath = join(sourcePath, "project");
  mkdirSync(projectPath);
  let projectId: string | undefined;
  try {
    const project = await request.post(`${uiOrigin}/v1/projects`, {
      data: folderProjectInput({ name: "Native view actions" }, projectPath),
    });
    expect(project.ok(), await project.text()).toBe(true);
    projectId = (await project.json()).id;
    const enabled = await request.post(
      `${uiOrigin}/v1/projects/${projectId}/extensions/installed/native-actions/enable`,
      {
        data: {
          displayName: "Native actions",
          extensionId: "e2e.native-actions",
          manifest: { id: "e2e.native-actions", name: "native-actions" },
          name: "native-actions",
          sourceHash: "native-actions",
          sourceKind: "local_path",
          sourcePath,
          sourceRef: null,
          version: "0.1.0",
        },
      },
    );
    expect(enabled.ok()).toBe(true);
    await page.addInitScript((id) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", id!);
    }, projectId);
    for (const view of ["table", "board"]) {
      await page.goto(`/projects/${projectId}/extensions/e2e.native-actions/${view}`);
      const action = page.getByRole("button", { name: "Run experiment", exact: true });
      await expect(action).toBeVisible();
      await expect(page.getByRole("button", { name: "Disabled experiment" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Hidden experiment" })).toHaveCount(0);
      await action.click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: "a,b", exact: true }).click();
      await expect(page.getByText("Known tag", { exact: true })).toBeVisible();
      await page.getByPlaceholder("Search options…").fill("new,tag");
      await page.getByText('Use "new,tag"', { exact: true }).click();
      await page.keyboard.press("Escape");
      if (view === "table") {
        await dialog.getByRole("button", { name: "Select region", exact: true }).click();
        await page.getByRole("menuitemradio", { name: "Error", exact: true }).click();
        await expect(dialog.getByText("Options unavailable", { exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: "Retry", exact: true }).click();
        await expect(dialog.getByText("Options unavailable", { exact: true })).toHaveCount(0);
        await dialog.getByRole("button", { name: "Error", exact: true }).click();
        await page.getByRole("menuitemradio", { name: "Empty", exact: true }).click();
        await expect(dialog.getByText("No options available.", { exact: true })).toBeVisible();
        await expect(dialog.getByRole("button", { name: "Start experiment" })).toBeDisabled();
      }
      await dialog.getByRole("button", { name: /Select region|Europe|America|Empty/ }).click();
      await page.getByRole("menuitemradio", { name: "Europe", exact: true }).click();
      await dialog.getByRole("button", { name: /Select locale|German|English/ }).click();
      await page.getByRole("menuitemradio", { name: "German", exact: true }).click();
      await expect(dialog.getByRole("button", { name: "Start experiment" })).toBeEnabled();
      await dialog.getByRole("button", { name: /Select region|Europe|America|Empty/ }).click();
      await page.getByRole("menuitemradio", { name: "America", exact: true }).click();
      await expect(dialog.getByRole("button", { name: "Start experiment" })).toBeDisabled();
      await dialog.getByRole("button", { name: /Select locale|German|English/ }).click();
      await page.getByRole("menuitemradio", { name: "English", exact: true }).click();
      await dialog.getByRole("button", { name: "Start experiment" }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByText('toolbar: us/en ["a,b","new,tag"]', { exact: true }).last()).toBeVisible();
      await testInfo.attach(`${view}-action`, { body: await page.screenshot(), contentType: "image/png" });
    }
  } finally {
    if (projectId) await request.delete(`${uiOrigin}/v1/projects/${projectId}`);
    rmSync(sourcePath, { force: true, recursive: true });
  }
});
