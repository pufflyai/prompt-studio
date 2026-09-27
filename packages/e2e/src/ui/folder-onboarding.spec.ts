import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { uiOrigin } from "../ui-server";

const sharedRoot = resolve(import.meta.dirname, "../../../../__test-tmp__");
const openPicker = async (page: import("@playwright/test").Page) => {
  await page.getByRole("button", { name: "Switch project", exact: true }).click();
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  return page.getByRole("dialog").filter({ hasText: "Open project folder" });
};
const navigate = async (picker: import("@playwright/test").Locator, path: string) => {
  await picker.getByRole("textbox", { name: "Folder path", exact: true }).fill(path);
  await picker.getByRole("textbox", { name: "Folder path", exact: true }).press("Enter");
  await expect(picker.getByRole("button", { name: "Open folder", exact: true })).toBeEnabled();
  await expect(picker.getByRole("textbox", { name: "Folder path", exact: true })).toHaveValue(realpathSync(path));
};

test("opens a created Unicode folder, reuses it, and preserves files after deletion", async ({ page, request }) => {
  mkdirSync(sharedRoot, { recursive: true });
  const parent = realpathSync(mkdtempSync(join(sharedRoot, "folder-onboarding-")));
  const child = join(parent, "123 笔记");
  let projectId: string | undefined;
  try {
    await page.goto("/");
    // The project chooser may already be open on an empty host.
    if (!(await page.getByRole("button", { name: "Create project", exact: true }).isVisible())) {
      await page.getByRole("button", { name: "Switch project", exact: true }).click();
    }
    await page.getByRole("button", { name: "Create project", exact: true }).click();
    const picker = page.getByRole("dialog").filter({ hasText: "Open project folder" });
    await navigate(picker, parent);
    await picker.getByRole("button", { name: "New folder", exact: true }).click();
    await picker.getByRole("textbox", { name: "New folder name" }).fill("123 笔记");
    await picker.getByRole("button", { name: "Create folder", exact: true }).click();
    await expect(picker.getByRole("textbox", { name: "Folder path", exact: true })).toHaveValue(child);
    writeFileSync(join(child, "notes.txt"), "Keep my notes.\n");
    await picker.getByRole("button", { name: "Open folder", exact: true }).click();
    await expect(picker).toBeHidden();
    const config = JSON.parse(readFileSync(join(child, ".pstdio/config.json"), "utf8"));
    projectId = config.project_id;
    const project = await (await request.get(`${uiOrigin}/v1/projects/${projectId}`)).json();
    expect(project.name).toBe("123 笔记");
    const workspaces = await (await request.get(`${uiOrigin}/v1/workspaces?project_id=${projectId}`)).json();
    expect(workspaces).toEqual([
      expect.objectContaining({ root_path: child, is_default: true, provider_id: "pstdio.root" }),
    ]);
    const repeated = await openPicker(page);
    await navigate(repeated, child);
    await repeated.getByRole("button", { name: "Open folder", exact: true }).click();
    await expect(repeated).toBeHidden();
    expect(JSON.parse(readFileSync(join(child, ".pstdio/config.json"), "utf8")).project_id).toBe(projectId);
    const deletion = await request.delete(`${uiOrigin}/v1/projects/${projectId}`);
    expect(deletion.ok()).toBe(true);
    expect(readFileSync(join(child, "notes.txt"), "utf8")).toBe("Keep my notes.\n");
  } finally {
    if (projectId) await request.delete(`${uiOrigin}/v1/projects/${projectId}`);
    rmSync(parent, { recursive: true, force: true });
  }
});

for (const blocker of ["file", "foreign binding"]) {
  test(`keeps setup blocked by a ${blocker} open and retries the same project after repair`, async ({
    page,
    request,
  }) => {
    mkdirSync(sharedRoot, { recursive: true });
    const folder = realpathSync(mkdtempSync(join(sharedRoot, "folder-retry-")));
    const configPath = join(folder, ".pstdio");
    let blockedPath = configPath;
    let content = "User content blocking setup";
    if (blocker === "foreign binding") {
      mkdirSync(configPath);
      blockedPath = join(configPath, "config.json");
      content = JSON.stringify({ project_id: "another-host-project", workspace_id: "another-host-workspace" });
    }
    writeFileSync(blockedPath, content);
    let projectId: string | undefined;
    try {
      await page.goto("/");
      if (!(await page.getByRole("button", { name: "Create project", exact: true }).isVisible()))
        await page.getByRole("button", { name: "Switch project", exact: true }).click();
      await page.getByRole("button", { name: "Create project", exact: true }).click();
      const picker = page.getByRole("dialog").filter({ hasText: "Open project folder" });
      await navigate(picker, folder);
      await picker.getByRole("button", { name: "Open folder", exact: true }).click();
      await expect(picker.getByRole("alert")).toBeVisible();
      expect(readFileSync(blockedPath, "utf8")).toBe(content);
      const projects = await (await request.get(`${uiOrigin}/v1/projects`)).json();
      projectId = projects.find((project: { name: string }) => project.name === folder.split("/").at(-1)).id;
      const workspaceUrl = `${uiOrigin}/v1/workspaces?project_id=${projectId}`;
      const [failed] = await (await request.get(workspaceUrl)).json();
      expect(failed.setup_error).toBeTruthy();
      rmSync(configPath, { recursive: true });
      await picker.getByRole("button", { name: "Open folder", exact: true }).click();
      await expect(picker).toBeHidden();
      const [ready] = await (await request.get(workspaceUrl)).json();
      expect(ready).toMatchObject({ id: failed.id, project_id: projectId, setup_error: null, initializing: false });
      expect(JSON.parse(readFileSync(join(configPath, "config.json"), "utf8")).project_id).toBe(projectId);
    } finally {
      if (projectId) await request.delete(`${uiOrigin}/v1/projects/${projectId}`);
      rmSync(folder, { recursive: true, force: true });
    }
  });
}
