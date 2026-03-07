import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "opencode");
  });
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, {
    data: { name },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string };
};

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  const projects = (await res.json()) as { id: string }[];
  for (const p of projects) {
    await request.delete(`${apiBase}/v1/projects/${p.id}`);
  }
};

interface DirectorySnapshot {
  currentPath: string;
  entries: Array<{ name: string }>;
}

const resolveParentPath = (value: string) => {
  const trimmed = value.replace(/\\/g, "/").replace(/\/+$/g, "");
  if (!trimmed) return "/";
  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length <= 1) return "/";
  return `/${parts.slice(0, -1).join("/")}`;
};

const listDirectory = async (request: import("@playwright/test").APIRequestContext, path?: string) => {
  const query = path ? `?path=${encodeURIComponent(path)}` : "";
  const res = await request.get(`${apiBase}/v1/filesystem/list${query}`);
  expect(res.ok()).toBe(true);
  return (await res.json()) as DirectorySnapshot;
};

const isGitRootFolder = (snapshot: DirectorySnapshot) => snapshot.entries.some((entry) => entry.name === ".git");

const resolveFolderPickerDefaultDirectory = async (request: import("@playwright/test").APIRequestContext) => {
  let snapshot = await listDirectory(request);

  while (true) {
    if (isGitRootFolder(snapshot)) {
      const parentPath = resolveParentPath(snapshot.currentPath);
      if (parentPath === snapshot.currentPath) {
        const home = await listDirectory(request, "~");
        return home.currentPath;
      }
      return parentPath;
    }

    const parentPath = resolveParentPath(snapshot.currentPath);
    if (parentPath === snapshot.currentPath) {
      const home = await listDirectory(request, "~");
      return home.currentPath;
    }

    snapshot = await listDirectory(request, parentPath);
  }
};

const createTempGitRepo = (parentDir: string) => {
  const repoPath = mkdtempSync(join(parentDir, "pstdio-e2e-picker-"));
  mkdirSync(join(repoPath, ".git"), { recursive: true });
  return repoPath;
};

const selectRepoFromFolderPicker = async (page: import("@playwright/test").Page, repoPath: string) => {
  const repoName = basename(repoPath);
  const dialog = page.getByRole("dialog").last();
  const repoOption = dialog.getByRole("option").filter({ hasText: repoName }).first();

  await page.getByRole("button", { name: "Browse for repository" }).click();
  await expect(dialog.getByText("No entries found.")).not.toBeVisible();
  await expect(repoOption).toBeVisible();
  await repoOption.click();
  await dialog.getByRole("button", { name: /Select (Path|repository)/ }).click();
};

test.describe("Project list", () => {
  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
  });

  test("shows empty state when no projects exist", async ({ page }) => {
    await bypassOnboarding(page);
    await page.goto("/projects");

    await expect(page.getByText("No projects yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create your first project" })).toBeVisible();
  });

  test("lists projects seeded via API", async ({ page, request }) => {
    await bypassOnboarding(page);

    await createProjectViaApi(request, "Alpha Project");
    await createProjectViaApi(request, "Beta Project");

    await page.goto("/projects");

    await expect(page.getByText("Alpha Project", { exact: true })).toBeVisible();
    await expect(page.getByText("Beta Project", { exact: true })).toBeVisible();
    await expect(page.getByText(/You have \d+ projects?/)).toBeVisible();
  });

  test("navigates to project tickets on click", async ({ page, request }) => {
    await bypassOnboarding(page);

    const project = await createProjectViaApi(request, "Nav Test Project");

    await page.goto("/projects");
    await page.getByText("Nav Test Project", { exact: true }).click();

    await page.waitForURL(`**/projects/${project.id}/tickets`);
    expect(page.url()).toContain(`/projects/${project.id}/tickets`);
  });
});

test.describe("Project creation", () => {
  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
  });

  test("folder picker shows directory entries", async ({ page, request }) => {
    const defaultDirectory = await resolveFolderPickerDefaultDirectory(request);
    const repoPath = createTempGitRepo(defaultDirectory);
    const repoName = basename(repoPath);
    const dialog = page.getByRole("dialog").last();
    const repoOption = dialog.getByRole("option").filter({ hasText: repoName }).first();

    try {
      await bypassOnboarding(page);
      await page.goto("/projects");

      await page.getByRole("button", { name: "Create project" }).first().click();
      await page.getByRole("button", { name: "Browse for repository" }).click();

      await expect(dialog.getByText("No entries found.")).not.toBeVisible();
      await expect(repoOption).toBeVisible();
    } finally {
      rmSync(repoPath, { recursive: true, force: true });
    }
  });

  test("creates a project via the dialog", async ({ page, request }) => {
    const defaultDirectory = await resolveFolderPickerDefaultDirectory(request);
    const repoPath = createTempGitRepo(defaultDirectory);
    const repoName = basename(repoPath);

    try {
      await bypassOnboarding(page);
      await page.goto("/projects");

      // open dialog via header button
      await page.getByRole("button", { name: "Create project" }).first().click();
      await expect(page.getByPlaceholder("Project name")).toBeVisible();

      // fill project name
      await page.getByPlaceholder("Project name").fill("My New Project");

      // add a repository via folder picker
      await selectRepoFromFolderPicker(page, repoPath);

      // verify repo appears in the dialog
      const createProjectDialog = page.getByRole("dialog").first();
      await expect(createProjectDialog.getByText(repoName, { exact: true })).toBeVisible();

      // submit via the dialog footer button
      await page.getByRole("button", { name: "Create project", exact: true }).last().click();

      // verify project appears in the list (scoped to avoid matching toast)
      const main = page.locator("#root > *").first();
      await expect(main.getByText("My New Project", { exact: true })).toBeVisible();
    } finally {
      rmSync(repoPath, { recursive: true, force: true });
    }
  });

  test("shows validation errors when submitting empty form", async ({ page }) => {
    await bypassOnboarding(page);
    await page.goto("/projects");

    await page.getByRole("button", { name: "Create project" }).first().click();

    // click create without filling anything
    await page.getByRole("button", { name: "Create project", exact: true }).last().click();

    await expect(page.getByText("Project name is required.")).toBeVisible();
    await expect(page.getByText("Select at least one repository.")).toBeVisible();
  });

  test("can create project from empty state CTA", async ({ page, request }) => {
    const defaultDirectory = await resolveFolderPickerDefaultDirectory(request);
    const repoPath = createTempGitRepo(defaultDirectory);

    try {
      await bypassOnboarding(page);
      await page.goto("/projects");

      // click the empty-state CTA
      await page.getByRole("button", { name: "Create your first project" }).click();

      // dialog should open
      await expect(page.getByPlaceholder("Project name")).toBeVisible();

      // fill and submit
      await page.getByPlaceholder("Project name").fill("CTA Project");
      await selectRepoFromFolderPicker(page, repoPath);
      await page.getByRole("button", { name: "Create project", exact: true }).last().click();

      const main = page.locator("#root > *").first();
      await expect(main.getByText("CTA Project", { exact: true })).toBeVisible();
    } finally {
      rmSync(repoPath, { recursive: true, force: true });
    }
  });
});
