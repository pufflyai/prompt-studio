import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";

export const prepareDashboard = async (page: Page, projectId: string) => {
  await page.addInitScript(
    ({ selectedProjectId }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
      localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
      localStorage.setItem(
        `pstdio-project-settings/projects/${selectedProjectId}/values`,
        JSON.stringify({
          state: {
            lastSelectedAgent: "pstdio.workbench-fixture.harness.fake",
            lastSelectedModels: [],
            lastSelectedBranches: [],
            sessionModalState: "closed",
            selectedSessionId: null,
          },
          version: 0,
        }),
      );
    },
    { selectedProjectId: projectId },
  );
};

export const openWorkspace = async (page: Page, shorthand: string) => {
  const row = page
    .getByRole("region", { name: "Main", exact: true })
    .getByRole("option")
    .filter({ hasText: shorthand })
    .first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();
};

export const expectFoldersBeforeFiles = async (filesTree: Locator) => {
  const folder = filesTree.getByRole("option", { name: "zzz-folder", exact: true });
  const file = filesTree.getByRole("option", { name: "LICENSE", exact: true });
  await expect(folder).toBeVisible();
  await expect(file).toBeVisible();
  const folderBounds = await folder.boundingBox();
  const fileBounds = await file.boundingBox();
  expect(folderBounds!.y).toBeLessThan(fileBounds!.y);
};

export const moveEntryToFolder = async (page: Page, filesTree: Locator, sourcePath: string, folder: Locator) => {
  const source = filesTree.getByRole("option", { name: sourcePath }).locator("xpath=..");
  await expect(source).toHaveAttribute("draggable", "true");
  await expect(folder).toBeVisible();
  const bounds = (await folder.boundingBox())!;
  const point = { clientX: bounds.x + bounds.width / 2, clientY: bounds.y + bounds.height / 2 };
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  const dragged = (await source.elementHandle())!;
  await dragged.dispatchEvent("dragstart", { dataTransfer });
  await folder.dispatchEvent("dragover", { dataTransfer, ...point });
  await folder.dispatchEvent("drop", { dataTransfer, ...point });
  await dragged.dispatchEvent("dragend", { dataTransfer });
  await dragged.dispose();
  await dataTransfer.dispose();
};

export const expectWorkspaceDocument = async (page: Page, path: string) => {
  await expect(page).toHaveURL((url) => url.searchParams.get("document") === path);
  await expect(page.locator(".monaco-editor").filter({ visible: true })).toBeVisible();
};

export const exerciseWorkspaceFileOperations = async (input: {
  page: Page;
  filesTree: Locator;
  assets: Locator;
  worktreePath: string;
}) => {
  const { page, filesTree, assets, worktreePath } = input;
  await moveEntryToFolder(page, filesTree, "LICENSE", assets);
  await expect.poll(() => existsSync(join(worktreePath, "assets/LICENSE"))).toBe(true);
  await expectWorkspaceDocument(page, "assets/LICENSE");
  for (const [action, expected] of [
    ["Copy path", join(worktreePath, "assets")],
    ["Copy relative path", "assets"],
  ]) {
    await assets.click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: "Reveal in Finder" })).toHaveCount(0);
    await page.getByRole("menuitem", { name: action, exact: true }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
  }
  await filesTree.getByText("Files", { exact: true }).hover();
  await filesTree.getByRole("button", { name: "New folder", exact: true }).click();
  const folderInput = filesTree.getByRole("textbox", { name: "Folder name", exact: true });
  await folderInput.fill("generated");
  await folderInput.press("Enter");
  await expect.poll(() => existsSync(join(worktreePath, "generated"))).toBe(true);
  const generated = filesTree.getByRole("option", { name: "generated", exact: true });
  await moveEntryToFolder(page, filesTree, "zzz-folder", generated);
  await expect.poll(() => existsSync(join(worktreePath, "generated/zzz-folder/keep.txt"))).toBe(true);
  await generated.focus();
  await generated.press("ArrowRight");
  // The filesystem move can finish before the refreshed tree removes the old root row.
  const moved = filesTree.locator('[data-tree-list-node-id="generated/zzz-folder"]');
  await moved.focus();
  await moved.press("ArrowRight");
  await filesTree.getByRole("option", { name: "keep.txt", exact: true }).click();
  await expectWorkspaceDocument(page, "generated/zzz-folder/keep.txt");
  await generated.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  const renameFolder = filesTree.getByRole("textbox", { name: "Folder name", exact: true });
  await expect(renameFolder).toBeFocused();
  await renameFolder.fill("generated-renamed");
  await renameFolder.press("Enter");
  await expect.poll(() => existsSync(join(worktreePath, "generated-renamed/zzz-folder/keep.txt"))).toBe(true);
  await expectWorkspaceDocument(page, "generated-renamed/zzz-folder/keep.txt");
  await page.reload();
  await expect(filesTree.getByRole("option", { name: "keep.txt", exact: true })).toBeVisible();
  await expectWorkspaceDocument(page, "generated-renamed/zzz-folder/keep.txt");
  await filesTree.getByText("Files", { exact: true }).hover();
  await filesTree.getByRole("button", { name: "New file", exact: true }).click();
  const fileInput = filesTree.getByRole("textbox", { name: "File name", exact: true });
  await fileInput.fill("created.md");
  await fileInput.press("Enter");
  await expect.poll(() => existsSync(join(worktreePath, "created.md"))).toBe(true);
  const created = filesTree.getByRole("option", { name: "created.md", exact: true });
  await created.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  const renameFile = filesTree.getByRole("textbox", { name: "File name", exact: true });
  await expect(renameFile).toHaveValue("created.md");
  await expect(renameFile).toBeFocused();
  await renameFile.fill("renamed.md");
  await renameFile.press("Enter");
  await expectWorkspaceDocument(page, "renamed.md");
  const action = page.frameLocator('iframe[title="Workspace action"]');
  const remove = async (row: Locator, label: string) => {
    await row.click({ button: "right" });
    await page.getByRole("menuitem", { name: label, exact: true }).click();
    await expect(action.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
  };
  const renamed = filesTree.getByRole("option", { name: "renamed.md", exact: true });
  await remove(renamed, "Delete file");
  await action.getByRole("button", { name: "Cancel", exact: true }).click();
  await expectWorkspaceDocument(page, "renamed.md");
  expect(existsSync(join(worktreePath, "renamed.md"))).toBe(true);
  await remove(renamed, "Delete file");
  await action.getByRole("button", { name: "Delete", exact: true }).click();
  await expect.poll(() => existsSync(join(worktreePath, "renamed.md"))).toBe(false);
  await expect(page.getByText("Select a file", { exact: true })).toBeVisible();
  await remove(assets, "Delete folder");
  await action.getByRole("button", { name: "Delete", exact: true }).click();
  await expect.poll(() => existsSync(join(worktreePath, "assets"))).toBe(false);
};
