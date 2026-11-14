import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { expectWorkspaceDocument, prepareDashboard } from "./helpers/workspace-files";

// Critical: external changes must appear without navigation; file actions must keep the editor usable.
test("file explorer updates externally and creates and confirms deletion over its editor", async ({
  page,
  request,
}) => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-file-explorer-"));
  writeFileSync(join(root, "README.md"), "# Keep this document open\n");
  const response = await request.post("/v1/projects", { data: folderProjectInput({ name: "File explorer" }, root) });
  expect(response.ok()).toBe(true);
  const project = await response.json();
  try {
    await prepareDashboard(page, project.id);
    await page.goto(`/projects/${project.id}`);
    await page.getByRole("option", { name: "Files", exact: true }).click();
    const tree = page.getByRole("region", { name: "Files", exact: true });
    await tree.locator('[data-tree-list-node-id="README.md"]').click();
    await expectWorkspaceDocument(page, "README.md");
    const originalUrl = page.url();
    writeFileSync(join(root, "external.txt"), "External writer\n");
    const external = tree.getByRole("option", { name: "external.txt", exact: true });
    await expect(external).toBeVisible();
    rmSync(join(root, "external.txt"));
    await expect(external).toHaveCount(0);
    await expect(page).toHaveURL(originalUrl);

    for (const [kind, name] of [
      ["folder", "new-folder"],
      ["file", "new-file.md"],
    ]) {
      const background = tree.locator("[data-tree-list-background]");
      const bounds = (await background.boundingBox())!;
      await background.click({ button: "right", position: { x: 20, y: bounds.height - 20 } });
      await page.getByRole("menuitem", { name: `New ${kind}`, exact: true }).click();
      const input = tree.getByRole("textbox", { name: kind === "file" ? "File name" : "Folder name", exact: true });
      await expect(input).toBeFocused();
      await input.fill(name!);
      await input.press("Enter");
      await expect(tree.getByRole("option", { name, exact: true })).toBeVisible();
      expect(existsSync(join(root, name!))).toBe(true);
    }
    await expectWorkspaceDocument(page, "new-file.md");
    const documentUrl = page.url();
    const row = tree.getByRole("option", { name: "new-file.md", exact: true });
    const openDelete = async () => {
      await row.click({ button: "right" });
      await page.getByRole("menuitem", { name: "Delete file", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.locator('iframe[title="Workspace action"]')).toHaveCount(0);
      await expect(
        page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).filter({ hasText: "Close" }),
      ).toBeVisible();
      await expect(page).toHaveURL(documentUrl);
      await expect(page.locator(".monaco-editor").filter({ visible: true })).toBeVisible();
    };
    const confirmation = page.getByRole("dialog");
    await openDelete();
    await confirmation.getByRole("button", { name: "Close", exact: true }).filter({ hasText: "Close" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expectWorkspaceDocument(page, "new-file.md");
    expect(existsSync(join(root, "new-file.md"))).toBe(true);
    await openDelete();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expectWorkspaceDocument(page, "new-file.md");
    await openDelete();
    await confirmation.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect.poll(() => existsSync(join(root, "new-file.md"))).toBe(false);
    await expect(row).toHaveCount(0);
  } finally {
    await request.delete(`/v1/projects/${project.id}`);
    rmSync(root, { recursive: true, force: true });
  }
});

// Critical: refreshing selection must not remove expanded rows and clamp the explorer's scroll position.
test("opening a deeply nested file preserves the expanded tree and scroll position", async ({ page, request }) => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-deep-file-"));
  const path = "src/one/two/three/target.md";
  mkdirSync(join(root, "src/one/two/three"), { recursive: true });
  mkdirSync(join(root, "before"));
  for (let index = 0; index < 40; index++) writeFileSync(join(root, `before/file-${index}.txt`), "Sibling\n");
  writeFileSync(join(root, path), "# Deep file\n");
  const response = await request.post("/v1/projects", { data: folderProjectInput({ name: "Deep explorer" }, root) });
  expect(response.ok()).toBe(true);
  const project = await response.json();
  try {
    await prepareDashboard(page, project.id);
    await page.goto(`/projects/${project.id}`);
    await page.getByRole("option", { name: "Files", exact: true }).click();
    const tree = page.getByRole("region", { name: "Files", exact: true });
    await tree.locator('[data-tree-list-node-id="before"]').click();
    const viewport = tree.locator('[data-scope="scroll-area"][data-part="viewport"]');
    await expect.poll(() => viewport.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    await viewport.evaluate((element) => element.scrollTo(0, element.scrollHeight));
    for (const folder of ["src", "src/one", "src/one/two", "src/one/two/three"])
      await tree.locator(`[data-tree-list-node-id="${folder}"]`).click();
    const target = tree.locator(`[data-tree-list-node-id="${path}"]`);
    await target.scrollIntoViewIfNeeded();
    const before = (await target.boundingBox())!.y;
    const scrollTop = await viewport.evaluate((element) => element.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
    await tree.evaluate((_element, documentPath) => {
      const positions: (number | null)[] = [];
      const sample = () => {
        const row = document.querySelector(`section[aria-label="Files"] [data-tree-list-node-id="${documentPath}"]`);
        positions.push(row?.getBoundingClientRect().y ?? null);
      };
      sample();
      const observer = new MutationObserver(sample);
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      Object.assign(window, { explorerPositions: positions, stopExplorerObservation: () => observer.disconnect() });
    }, path);
    await target.click();
    await expectWorkspaceDocument(page, path);
    await expect(tree).toHaveAttribute("aria-busy", "false");
    const positions = await page.evaluate(() => {
      const observation = window as typeof window & {
        explorerPositions: (number | null)[];
        stopExplorerObservation(): void;
      };
      observation.stopExplorerObservation();
      return observation.explorerPositions;
    });
    expect(positions.length).toBeGreaterThan(0);
    expect(positions.every((position) => position !== null && Math.abs(position - before) < 2)).toBe(true);
    expect((await target.boundingBox())!.y).toBeCloseTo(before, 0);
    expect(await viewport.evaluate((element) => element.scrollTop)).toBeCloseTo(scrollTop, 0);
  } finally {
    await request.delete(`/v1/projects/${project.id}`);
    rmSync(root, { recursive: true, force: true });
  }
});
