import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";

export const getResizeSeparatorColors = (separator: Locator) =>
  separator.evaluate((element) => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = "var(--chakra-colors-border)";
    document.body.append(probe);
    const expected = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { actual: getComputedStyle(element, "::before").backgroundColor, expected };
  });

export const prepareDashboard = async (page: Page, projectId: string, repoId: string) => {
  await page.addInitScript(
    ({ selectedProjectId, selectedRepoId }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", "pstdio.extension-lab.harness.fake");
      localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
      localStorage.setItem(
        `pstdio-project-settings/projects/${selectedProjectId}/values`,
        JSON.stringify({
          state: {
            lastSelectedAgent: "pstdio.extension-lab.harness.fake",
            lastSelectedModels: [],
            lastSelectedRepo: selectedRepoId,
            lastSelectedBranches: [],
            sessionModalState: "closed",
            selectedSessionId: null,
          },
          version: 0,
        }),
      );
    },
    { selectedProjectId: projectId, selectedRepoId: repoId },
  );
};

export const openWorkspace = async (page: Page, shorthand: string) => {
  const row = page.getByRole("option").filter({ hasText: shorthand }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.getByText(shorthand, { exact: true }).click();
};

export const expectStandardFileSearch = async (search: Locator) => {
  const height = await search.evaluate((element) => element.closest("header")?.getBoundingClientRect().height);
  expect(height).toBe(40);
  await expect(search).toHaveCSS("border-top-width", "0px");
  await expect(search).toHaveCSS("border-radius", "0px");
  await expect(search).toHaveCSS("margin-left", "0px");
  await expect(search).toHaveCSS("margin-right", "0px");
};

export const expectFoldersBeforeFiles = async (filesTree: Locator) => {
  const rootPaths = await filesTree
    .getByRole("option")
    .evaluateAll((rows) =>
      rows
        .filter((row) => row.getAttribute("aria-level") === "1")
        .map((row) => row.getAttribute("data-tree-list-node-id")),
    );
  expect(rootPaths.indexOf("zzz-folder")).toBeLessThan(rootPaths.indexOf("LICENSE"));
};

export const moveEntryToFolder = async (page: Page, filesTree: Locator, sourcePath: string, folder: Locator) => {
  const source = filesTree.getByRole("option", { name: sourcePath }).locator("xpath=..");
  await expect(source).toHaveAttribute("draggable", "true");
  await expect(folder).toBeVisible();
  const response = page.waitForResponse(
    (candidate) =>
      new URL(candidate.url()).pathname.endsWith("/entry") &&
      new URL(candidate.url()).searchParams.get("path") === sourcePath &&
      candidate.request().method() === "PATCH",
  );
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent("dragstart", { dataTransfer });
  await folder.dispatchEvent("dragover", { dataTransfer });
  await folder.dispatchEvent("drop", { dataTransfer });
  await source.dispatchEvent("dragend", { dataTransfer });
  await dataTransfer.dispose();
  expect((await response).status()).toBe(204);
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
  await expect(page.getByLabel("File path assets/LICENSE")).toBeVisible();
  await assets.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "New file" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "New folder" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Reveal in Finder" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Copy path" }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(join(worktreePath, "assets"));
  await assets.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Copy relative path" }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("assets");
  await assets.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Delete folder" })).toBeVisible();
  await page.keyboard.press("Escape");

  await filesTree.getByText("Files", { exact: true }).hover();
  await filesTree.getByRole("button", { name: "New folder" }).first().click();
  const newFolderInput = filesTree.getByRole("textbox", { name: "New folder name" });
  await newFolderInput.fill("generated");
  const createFolderResponse = page.waitForResponse(
    (response) => response.url().includes("/directory?path=generated") && response.request().method() === "POST",
  );
  await newFolderInput.press("Enter");
  expect((await createFolderResponse).status()).toBe(201);
  await expect.poll(() => existsSync(join(worktreePath, "generated"))).toBe(true);
  const generatedFolder = filesTree.getByRole("option", { name: "generated" });
  await expect(generatedFolder).toBeVisible();

  await moveEntryToFolder(page, filesTree, "zzz-folder", generatedFolder);
  await expect.poll(() => existsSync(join(worktreePath, "generated/zzz-folder/keep.txt"))).toBe(true);
  const movedFolder = filesTree.locator('[data-tree-list-node-id="generated/zzz-folder"]');
  await expect(movedFolder).toBeVisible();
  await movedFolder.getByText("zzz-folder", { exact: true }).click();
  const nestedFile = filesTree.locator('[data-tree-list-node-id="generated/zzz-folder/keep.txt"]');
  await nestedFile.click();
  await expect(page.getByLabel("File path generated/zzz-folder/keep.txt")).toBeVisible();

  await generatedFolder.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const renameFolderDialog = page.getByRole("dialog").filter({ hasText: "Rename" });
  const folderName = renameFolderDialog.getByRole("textbox");
  await expect(folderName).toHaveValue("generated");
  await folderName.fill("generated-renamed");
  const renameFolderResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith("/entry") &&
      new URL(response.url()).searchParams.get("path") === "generated" &&
      response.request().method() === "PATCH",
  );
  await renameFolderDialog.getByRole("button", { name: "Rename" }).click();
  expect((await renameFolderResponse).status()).toBe(204);
  await expect.poll(() => existsSync(join(worktreePath, "generated-renamed/zzz-folder/keep.txt"))).toBe(true);
  await expect(page.getByLabel("File path generated-renamed/zzz-folder/keep.txt")).toBeVisible();

  await filesTree.getByText("Files", { exact: true }).hover();
  await filesTree.getByRole("button", { name: "New file" }).first().click();
  await expect(page.getByRole("dialog").filter({ hasText: "New file" })).toHaveCount(0);
  const newFileInput = filesTree.getByRole("textbox", { name: "New file name" });
  await newFileInput.fill("created.md");
  const createResponse = page.waitForResponse(
    (response) => response.url().includes("/file?path=created.md") && response.request().method() === "POST",
  );
  await newFileInput.press("Enter");
  expect((await createResponse).status()).toBe(201);
  await expect.poll(() => existsSync(join(worktreePath, "created.md"))).toBe(true);
  await expect(page.locator(".monaco-editor")).toBeVisible();
  await expect(page.getByText("Created created.md", { exact: true })).toHaveCount(0);

  const createdFile = page.getByRole("option").filter({ hasText: "created.md" }).first();
  await expect(createdFile.getByText("A", { exact: true })).toBeVisible();
  await expect(createdFile.getByRole("button", { name: "Resource actions" })).toHaveCount(0);
  await createdFile.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Reveal in Finder" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const renameFileDialog = page.getByRole("dialog").filter({ hasText: "Rename" });
  const fileName = renameFileDialog.getByRole("textbox");
  await expect(fileName).toHaveValue("created.md");
  await fileName.fill("renamed.md");
  const renameFileResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith("/entry") &&
      new URL(response.url()).searchParams.get("path") === "created.md" &&
      response.request().method() === "PATCH",
  );
  await renameFileDialog.getByRole("button", { name: "Rename" }).click();
  expect((await renameFileResponse).status()).toBe(204);
  await expect.poll(() => existsSync(join(worktreePath, "renamed.md"))).toBe(true);
  await expect(page.getByLabel("File path renamed.md")).toBeVisible();

  const renamedFile = page.getByRole("option").filter({ hasText: "renamed.md" }).first();
  await renamedFile.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete file" }).click();
  const deleteDialog = page.getByRole("dialog").filter({ hasText: "Delete file" });
  await expect(deleteDialog.getByText("Delete renamed.md? This action cannot be undone.")).toBeVisible();
  const deleteResponse = page.waitForResponse(
    (response) => response.url().includes("/entry?path=renamed.md") && response.request().method() === "DELETE",
  );
  await deleteDialog.getByRole("button", { name: "Delete file", exact: true }).click();
  expect((await deleteResponse).status()).toBe(204);
  await expect.poll(() => existsSync(join(worktreePath, "renamed.md"))).toBe(false);
  await expect(page.getByText("Select a file", { exact: true })).toBeVisible();

  await assets.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete folder" }).click();
  const deleteFolderDialog = page.getByRole("dialog").filter({ hasText: "Delete folder" });
  await expect(deleteFolderDialog.getByText("Delete assets? This action cannot be undone.")).toBeVisible();
  const deleteFolderResponse = page.waitForResponse(
    (response) => response.url().includes("/entry?path=assets") && response.request().method() === "DELETE",
  );
  await deleteFolderDialog.getByRole("button", { name: "Delete folder", exact: true }).click();
  expect((await deleteFolderResponse).status()).toBe(204);
  await expect.poll(() => existsSync(join(worktreePath, "assets"))).toBe(false);
};
