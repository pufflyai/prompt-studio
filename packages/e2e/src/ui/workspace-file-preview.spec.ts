import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { uiOrigin as apiBase } from "../ui-server";
import { openWorkspace, prepareDashboard } from "./helpers/workspace-files";
import { createGitRepo, registerRepoViaApi } from "./helpers/workspace-session-attempt";

test("parses JSX in TSX file previews and still reports real TypeScript errors", async ({ page, request }) => {
  const projectResponse = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "TSX file preview" },
  });
  expect(projectResponse.ok()).toBe(true);
  const project = (await projectResponse.json()) as { id: string };
  const repoRoot = createGitRepo("pstdio-tsx-preview-", "TSX preview");
  const source = 'declare const React: any;\nexport const Icon = () => <svg width={24}><path d="M0 0" /></svg>;\n';
  writeFileSync(join(repoRoot, "icon.tsx"), source);

  try {
    const repo = await registerRepoViaApi(request, apiBase, project.id, "tsx-preview", repoRoot);
    await prepareDashboard(page, project.id, repo.id);
    await page.goto(`/projects/${project.id}/workspaces`);
    await openWorkspace(page, "tsx-preview");
    await page.getByRole("tab", { name: "Files" }).click();
    await page.getByRole("option", { name: /icon\.tsx/ }).click();
    const editor = page.locator(".monaco-editor");
    await expect(editor).toBeVisible();
    await editor.locator(".view-lines").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.insertText('\nexport const invalid: number = "wrong";');
    await expect(editor.locator(".squiggly-error").first()).toBeVisible();
    await page.keyboard.press("Control+a");
    await page.keyboard.insertText(source);
    await expect(editor.locator(".squiggly-error")).toHaveCount(0);
  } finally {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
