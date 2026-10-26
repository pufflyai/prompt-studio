import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { type APIRequestContext, expect, type Locator, type Page, test } from "@playwright/test";
import { uiOrigin } from "../ui-server";

const sharedRoot = resolve(import.meta.dirname, "../../../../__test-tmp__");
const openPicker = async (page: import("@playwright/test").Page) => {
  await page.getByRole("button", { name: "Switch project", exact: true }).click();
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  return page.getByRole("dialog").filter({ hasText: "Open project folder" });
};
const openPickerFromStart = async (page: import("@playwright/test").Page, request: APIRequestContext) => {
  const projects = (await (await request.get(`${uiOrigin}/v1/projects`)).json()) as { id: string }[];
  // Initial sync selects a sole project and closes the chooser. Wait for that
  // navigation before opening it, so it cannot disappear during the next click.
  if (projects.length === 1) {
    const projectPath = `/projects/${projects[0].id}`;
    await expect(page).toHaveURL((url) => url.pathname === projectPath || url.pathname.startsWith(`${projectPath}/`));
  }
  const createProject = page.getByRole("button", { name: "Create project", exact: true });
  const switchProject = page.getByRole("button", { name: "Switch project", exact: true });
  await expect(createProject.or(switchProject).first()).toBeVisible();
  if (!(await createProject.isVisible())) await switchProject.click();
  await createProject.click();
  return page.getByRole("dialog").filter({ hasText: "Open project folder" });
};
const navigate = async (picker: import("@playwright/test").Locator, path: string) => {
  await picker.getByRole("textbox", { name: "Folder path", exact: true }).fill(path);
  await picker.getByRole("textbox", { name: "Folder path", exact: true }).press("Enter");
  await expect(picker.getByRole("button", { name: "Open folder", exact: true })).toBeEnabled();
  await expect(picker.getByRole("textbox", { name: "Folder path", exact: true })).toHaveValue(realpathSync(path));
};

const openFolder = async (page: Page, picker: Locator) => {
  const opened = page.waitForResponse(
    (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/v1/projects",
  );
  await picker.getByRole("button", { name: "Open folder", exact: true }).click();
  const response = await opened;
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

test("opens a created Unicode folder, reuses it, and preserves files after deletion", async ({ page, request }) => {
  mkdirSync(sharedRoot, { recursive: true });
  const parent = realpathSync(mkdtempSync(join(sharedRoot, "folder-onboarding-")));
  const child = join(parent, "123 笔记");
  let projectId: string | undefined;
  try {
    await page.goto("/");
    const picker = await openPickerFromStart(page, request);
    await navigate(picker, parent);
    await picker.getByRole("button", { name: "New folder", exact: true }).click();
    await picker.getByRole("textbox", { name: "New folder name" }).fill("123 笔记");
    await picker.getByRole("button", { name: "Create folder", exact: true }).click();
    await expect(picker.getByRole("textbox", { name: "Folder path", exact: true })).toHaveValue(child);
    writeFileSync(join(child, "notes.txt"), "Keep my notes.\n");
    projectId = (await openFolder(page, picker)).id;
    await expect(picker).toBeHidden();
    const config = JSON.parse(readFileSync(join(child, ".pstdio/config.json"), "utf8"));
    expect(config.project_id).toBe(projectId);
    const project = await (await request.get(`${uiOrigin}/v1/projects/${projectId}`)).json();
    expect(project.name).toBe("123 笔记");
    const workspaces = await (await request.get(`${uiOrigin}/v1/workspaces?project_id=${projectId}`)).json();
    expect(workspaces).toEqual([
      expect.objectContaining({ root_path: child, is_default: true, provider_id: "pstdio.root" }),
    ]);
    const repeated = await openPicker(page);
    await navigate(repeated, child);
    expect((await openFolder(page, repeated)).id).toBe(projectId);
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
      const picker = await openPickerFromStart(page, request);
      await navigate(picker, folder);
      projectId = (await openFolder(page, picker)).id;
      await expect(picker.getByRole("alert")).toBeVisible();
      expect(readFileSync(blockedPath, "utf8")).toBe(content);
      const workspaceUrl = `${uiOrigin}/v1/workspaces?project_id=${projectId}`;
      const [failed] = await (await request.get(workspaceUrl)).json();
      expect(failed.setup_error).toBeTruthy();
      rmSync(configPath, { recursive: true });
      expect((await openFolder(page, picker)).id).toBe(projectId);
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
