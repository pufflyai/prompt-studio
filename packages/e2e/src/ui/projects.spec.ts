import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { enableCoreSkillsExtension, enableCoreTemplatesExtension } from "../extension-helpers";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const pickerLoadTimeoutMs = 15_000;
const projectCreationTimeoutMs = 25_000;
const resolveProjectDefaultPath = (projectId: string) => `/projects/${projectId}/tickets`;

const bypassOnboarding = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "opencode");
  });
};

const availableAgentsResponse = [
  { id: "opencode", name: "OpenCode", availability: { type: "INSTALLED" as const } },
  { id: "claude-code", name: "Claude Code", availability: { type: "INSTALLED" as const } },
];

const mockAvailableAgents = async (page: Page) => {
  await page.route("**/v1/agents/info", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(availableAgentsResponse),
    });
  });
};

const mockNoAvailableAgents = async (page: Page) => {
  await page.route("**/v1/agents/info", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
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
  expect(res.ok()).toBe(true);
  const projects = (await res.json()) as { id: string }[];
  for (const p of projects) {
    const del = await request.delete(`${apiBase}/v1/projects/${p.id}`);
    expect(del.ok()).toBe(true);
  }
};

const configureAgent = async (request: import("@playwright/test").APIRequestContext, agentId: string) => {
  const res = await request.post(`${apiBase}/v1/agents`, {
    data: { agent_id: agentId },
  });
  expect(res.ok()).toBe(true);
};

const resolveFolderPickerWorkspacePath = () => {
  let currentPath = process.cwd();

  while (true) {
    if (existsSync(join(currentPath, ".git"))) {
      const repoParentPath = dirname(currentPath);
      const parentSegments = splitPath(repoParentPath);
      const hiddenSegmentIndex = parentSegments.findIndex((segment) => segment.startsWith("."));
      const visibleParentPath =
        hiddenSegmentIndex === -1 ? repoParentPath : `/${parentSegments.slice(0, hiddenSegmentIndex).join("/")}` || "/";
      return join(visibleParentPath, "pstdio-e2e-picker-workspace");
    }

    const parentPath = dirname(currentPath);

    if (parentPath === currentPath) {
      return join(process.cwd(), "pstdio-e2e-picker-workspace");
    }

    currentPath = parentPath;
  }
};

const createTempGitRepo = () => {
  const pickerWorkspacePath = resolveFolderPickerWorkspacePath();
  mkdirSync(pickerWorkspacePath, { recursive: true });

  const repoPath = mkdtempSync(join(pickerWorkspacePath, "pstdio-e2e-picker-"));
  mkdirSync(join(repoPath, ".git"), { recursive: true });
  return repoPath;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const splitPath = (path: string) => path.split("/").filter(Boolean);
const getCommonPrefixLength = (left: string[], right: string[]) => {
  let index = 0;

  while (index < left.length && index < right.length && left[index] === right[index]) {
    index += 1;
  }

  return index;
};

const getProjectPickerModal = (page: Page) => page.getByTestId("project-picker-modal");

const getCreateProjectDialog = (page: Page) => page.getByTestId("create-project-dialog");

const getFolderPickerDialog = (page: Page) =>
  page
    .getByRole("dialog")
    .filter({ has: page.getByRole("button", { name: "Go to parent directory" }) })
    .last();

const waitForPickerToLoad = async (dialog: Locator) => {
  await expect(dialog.getByText("Loading...")).not.toBeVisible({ timeout: pickerLoadTimeoutMs });
};

const removeTempRepo = async (repoPath: string) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      rmSync(repoPath, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
};

const readPickerPath = async (dialog: Locator) => {
  const path = await dialog.locator("[data-testid='folder-picker-path']").textContent();
  return path?.trim() ?? "/";
};

const navigatePickerToDirectory = async (dialog: Locator, targetPath: string) => {
  const parentButton = dialog.getByRole("button", { name: "Go to parent directory" });
  const resolvedTargetPath = realpathSync(targetPath);
  const targetSegments = splitPath(resolvedTargetPath);

  await waitForPickerToLoad(dialog);
  let currentPath = await readPickerPath(dialog);
  let currentSegments = splitPath(currentPath);
  const commonPrefixLength = getCommonPrefixLength(currentSegments, targetSegments);

  while (currentSegments.length > commonPrefixLength) {
    const previousPath = currentPath;
    await parentButton.click();
    await waitForPickerToLoad(dialog);
    await expect.poll(() => readPickerPath(dialog)).not.toBe(previousPath);
    currentPath = await readPickerPath(dialog);
    currentSegments = splitPath(currentPath);
  }

  for (const segment of targetSegments.slice(commonPrefixLength)) {
    const expectedPath = currentPath === "/" ? `/${segment}` : `${currentPath}/${segment}`;
    const segmentOption = dialog
      .getByRole("option", { name: new RegExp(`^${escapeRegex(segment)}(?:\\s+Git repo)?$`) })
      .first();
    await expect(segmentOption).toBeAttached();
    await segmentOption.click();
    await waitForPickerToLoad(dialog);
    await expect.poll(() => readPickerPath(dialog)).toBe(expectedPath);
    currentPath = expectedPath;
  }
};

const selectRepoFromFolderPicker = async (page: Page, repoPath: string) => {
  const repoName = basename(repoPath);
  const createProjectDialog = getCreateProjectDialog(page);

  await createProjectDialog.getByRole("button", { name: "Browse for repository" }).click();

  const dialog = getFolderPickerDialog(page);
  const repoOption = dialog.getByRole("option").filter({ hasText: repoName }).first();

  await expect(dialog).toBeVisible();
  await navigatePickerToDirectory(dialog, dirname(repoPath));
  await expect(dialog.getByText("No entries found.")).not.toBeVisible();
  await expect(repoOption).toBeAttached();
  await repoOption.click();
  await dialog.getByRole("button", { name: "Select repository", exact: true }).click();
  await expect(createProjectDialog.getByText(repoName, { exact: true })).toBeVisible();
};

const getCreateProjectRow = (modal: Locator) => modal.getByRole("option", { name: "Create project", exact: true });

const openCreateProjectFromPicker = async (page: Page) => {
  const modal = getProjectPickerModal(page);
  await getCreateProjectRow(modal).click();
};

test.describe("Project picker modal", () => {
  test.beforeEach(async ({ request }) => {
    test.setTimeout(5_000);
    await deleteAllProjects(request);
  });

  test("shows empty state when no projects exist", async ({ page }) => {
    await bypassOnboarding(page);
    await mockAvailableAgents(page);
    await page.goto("/projects");

    const modal = getProjectPickerModal(page);
    await expect(modal).toBeVisible();
    await expect(modal.getByText("No projects yet")).toBeVisible();
  });

  test("lists projects seeded via API", async ({ page, request }) => {
    await bypassOnboarding(page);
    await mockAvailableAgents(page);

    await createProjectViaApi(request, "Alpha Project");
    await createProjectViaApi(request, "Beta Project");

    await page.goto("/projects");

    const modal = getProjectPickerModal(page);
    await expect(modal).toBeVisible();
    await expect(modal.getByText("Alpha Project", { exact: true })).toBeVisible();
    await expect(modal.getByText("Beta Project", { exact: true })).toBeVisible();
  });

  test("filters projects with the search input", async ({ page, request }) => {
    await bypassOnboarding(page);
    await mockAvailableAgents(page);

    await createProjectViaApi(request, "Alpha Project");
    await createProjectViaApi(request, "Beta Project");

    await page.goto("/projects");

    const modal = getProjectPickerModal(page);
    await expect(modal.getByText("Alpha Project", { exact: true })).toBeVisible();
    await modal.getByPlaceholder("Search projects...").fill("beta");
    await expect(modal.getByText("Alpha Project", { exact: true })).not.toBeVisible();
    await expect(modal.getByText("Beta Project", { exact: true })).toBeVisible();
  });

  test("navigates to project default path on click", async ({ page, request }) => {
    await bypassOnboarding(page);
    await mockAvailableAgents(page);

    const project = await createProjectViaApi(request, "Nav Test Project");

    await page.goto("/projects");
    await getProjectPickerModal(page).getByText("Nav Test Project", { exact: true }).click();

    await page.waitForURL(`**${resolveProjectDefaultPath(project.id)}`);
    expect(page.url()).toContain(resolveProjectDefaultPath(project.id));
  });

  test("shows no-agent warning and blocks project creation when no agents are available", async ({ page }) => {
    await bypassOnboarding(page);
    await mockNoAvailableAgents(page);
    await page.goto("/projects");

    const modal = getProjectPickerModal(page);
    await expect(modal.getByText("No coding agents available")).toBeVisible();
    await expect(getCreateProjectRow(modal)).toBeDisabled();
  });
});

test.describe("Project creation", () => {
  const tempRepoPaths: string[] = [];

  test.beforeEach(async ({ request }) => {
    test.setTimeout(projectCreationTimeoutMs);
    await deleteAllProjects(request);
  });

  test.afterEach(async () => {
    for (const repoPath of tempRepoPaths) {
      await removeTempRepo(repoPath);
    }
    tempRepoPaths.length = 0;
  });

  test("folder picker shows directory entries", async ({ page }) => {
    const repoPath = createTempGitRepo();
    tempRepoPaths.push(repoPath);
    const repoName = basename(repoPath);

    await bypassOnboarding(page);
    await mockAvailableAgents(page);
    await page.goto("/projects");

    await openCreateProjectFromPicker(page);
    await getCreateProjectDialog(page).getByRole("button", { name: "Browse for repository" }).click();
    const dialog = getFolderPickerDialog(page);
    const repoOption = dialog.getByRole("option").filter({ hasText: repoName }).first();

    await expect(dialog).toBeVisible();
    await navigatePickerToDirectory(dialog, dirname(repoPath));

    await expect(dialog.getByText("No entries found.")).not.toBeVisible();
    await expect(repoOption).toBeAttached();
  });

  test("creates a project via the dialog", async ({ page }) => {
    const repoPath = createTempGitRepo();
    tempRepoPaths.push(repoPath);
    const repoName = basename(repoPath);

    await bypassOnboarding(page);
    await mockAvailableAgents(page);
    await page.goto("/projects");

    await openCreateProjectFromPicker(page);
    await expect(page.getByPlaceholder("Project name")).toBeVisible();

    await page.getByPlaceholder("Project name").fill("My New Project");

    await selectRepoFromFolderPicker(page, repoPath);

    const createProjectDialog = getCreateProjectDialog(page);
    await expect(createProjectDialog.getByText(repoName, { exact: true })).toBeVisible();

    await createProjectDialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(createProjectDialog.getByText("Select agents")).toBeVisible();

    const selectedAgents = createProjectDialog.getByRole("checkbox", { checked: true });
    await expect(selectedAgents).toHaveCount(2);

    const createProjectDone = page.waitForResponse(
      (response) =>
        response.url().endsWith("/v1/projects") && response.request().method() === "POST" && response.status() === 201,
    );
    const createProjectButton = createProjectDialog.getByRole("button", { name: "Create project", exact: true });
    await expect(createProjectButton).toBeEnabled();
    await createProjectButton.click();
    const createdProjectResponse = await createProjectDone;
    const createdProject = (await createdProjectResponse.json()) as { id: string };

    await page.waitForURL(`**${resolveProjectDefaultPath(createdProject.id)}`);
    expect(page.url()).toContain(resolveProjectDefaultPath(createdProject.id));
  });

  test("requires at least one agent on step two", async ({ page }) => {
    const repoPath = createTempGitRepo();
    tempRepoPaths.push(repoPath);

    await bypassOnboarding(page);
    await mockAvailableAgents(page);
    await page.goto("/projects");

    await openCreateProjectFromPicker(page);
    await page.getByPlaceholder("Project name").fill("Agent Validation Project");
    await selectRepoFromFolderPicker(page, repoPath);

    const createProjectDialog = getCreateProjectDialog(page);
    await createProjectDialog.getByRole("button", { name: "Next", exact: true }).click();

    const checkboxes = createProjectDialog.getByRole("checkbox");
    await checkboxes.nth(0).uncheck();
    await checkboxes.nth(1).uncheck();
    await createProjectDialog.getByRole("button", { name: "Create project", exact: true }).click();

    await expect(createProjectDialog.getByText("Select at least one agent.")).toBeVisible();
  });

  test("creates alphabetically sorted templates when creating a project via the dialog", async ({ page, request }) => {
    const repoPath = createTempGitRepo();
    tempRepoPaths.push(repoPath);

    await bypassOnboarding(page);
    await mockAvailableAgents(page);
    await page.goto("/projects");

    await openCreateProjectFromPicker(page);
    await page.getByPlaceholder("Project name").fill("Templates Project");
    await selectRepoFromFolderPicker(page, repoPath);
    await getCreateProjectDialog(page).getByRole("button", { name: "Next", exact: true }).click();

    const createProjectDone = page.waitForResponse(
      (response) =>
        response.url().endsWith("/v1/projects") && response.request().method() === "POST" && response.status() === 201,
    );
    const createProjectButton = getCreateProjectDialog(page).getByRole("button", {
      name: "Create project",
      exact: true,
    });
    await expect(createProjectButton).toBeEnabled();
    await createProjectButton.click();
    const createdProjectResponse = await createProjectDone;
    const createdProject = (await createdProjectResponse.json()) as { id: string; name: string };
    await enableCoreTemplatesExtension(request, apiBase, createdProject.id);

    const templatesResponse = await request.get(`${apiBase}/v1/projects/${createdProject.id}/templates`);
    expect(templatesResponse.ok()).toBe(true);
    const templates = (await templatesResponse.json()) as Array<{ name: string; is_default: boolean }>;
    const names = templates.map((template) => template.name);

    expect(templates.length).toBeGreaterThan(0);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(templates.every((template) => !template.is_default)).toBe(true);
  });

  test("shows validation errors when submitting empty form", async ({ page }) => {
    await bypassOnboarding(page);
    await mockAvailableAgents(page);
    await page.goto("/projects");

    await openCreateProjectFromPicker(page);

    await getCreateProjectDialog(page).getByRole("button", { name: "Next", exact: true }).click();

    await expect(page.getByText("Project name is required.")).toBeVisible();
    await expect(page.getByText("Select at least one repository.")).toBeVisible();
  });
});

test.describe("Project creation integration", () => {
  const tempRepoPaths: string[] = [];

  test.beforeEach(async ({ request }) => {
    test.setTimeout(projectCreationTimeoutMs);
    await deleteAllProjects(request);
  });

  test.afterEach(async () => {
    for (const repoPath of tempRepoPaths) {
      await removeTempRepo(repoPath);
    }
    tempRepoPaths.length = 0;
  });

  test("installs skills in the repo when creating a project with a configured agent", async ({ page, request }) => {
    const repoPath = createTempGitRepo();
    tempRepoPaths.push(repoPath);

    await configureAgent(request, "opencode");

    await bypassOnboarding(page);
    await mockAvailableAgents(page);
    await page.goto("/projects");

    await openCreateProjectFromPicker(page);
    await page.getByPlaceholder("Project name").fill("Skills Project");
    await selectRepoFromFolderPicker(page, repoPath);
    await getCreateProjectDialog(page).getByRole("button", { name: "Next", exact: true }).click();
    const createProjectDone = page.waitForResponse(
      (response) =>
        response.url().endsWith("/v1/projects") && response.request().method() === "POST" && response.status() === 201,
    );
    const repoRegistrationDone = page.waitForResponse(
      (res) => res.url().includes("/repos") && res.request().method() === "POST" && res.status() === 201,
    );
    const createProjectButton = getCreateProjectDialog(page).getByRole("button", {
      name: "Create project",
      exact: true,
    });
    await expect(createProjectButton).toBeEnabled();
    await createProjectButton.click();
    const createdProjectResponse = await createProjectDone;
    const createdProject = (await createdProjectResponse.json()) as { id: string };

    await repoRegistrationDone;
    await page.waitForURL(`**${resolveProjectDefaultPath(createdProject.id)}`);
    expect(page.url()).toContain(resolveProjectDefaultPath(createdProject.id));
    await enableCoreSkillsExtension(request, apiBase, createdProject.id);

    expect(existsSync(join(repoPath, ".agents", "skills", "pstdio", "SKILL.md"))).toBe(true);
    expect(existsSync(join(repoPath, ".agents", "skills", "create-ticket", "SKILL.md"))).toBe(true);
  });

  test("registers repo when creating project with a repo path", async ({ page }) => {
    const repoPath = createTempGitRepo();
    tempRepoPaths.push(repoPath);

    await bypassOnboarding(page);
    await mockAvailableAgents(page);
    await page.goto("/projects");

    await openCreateProjectFromPicker(page);
    await page.getByPlaceholder("Project name").fill("Hook Project");
    await selectRepoFromFolderPicker(page, repoPath);
    await getCreateProjectDialog(page).getByRole("button", { name: "Next", exact: true }).click();

    const createProjectDone = page.waitForResponse(
      (response) =>
        response.url().endsWith("/v1/projects") && response.request().method() === "POST" && response.status() === 201,
    );
    const repoRegistrationDone = page.waitForResponse(
      (response) =>
        response.url().includes("/repos") && response.request().method() === "POST" && response.status() === 201,
    );
    const createProjectButton = getCreateProjectDialog(page).getByRole("button", {
      name: "Create project",
      exact: true,
    });
    await expect(createProjectButton).toBeEnabled();
    await createProjectButton.click();

    const createdProjectResponse = await createProjectDone;
    const createdProject = (await createdProjectResponse.json()) as { id: string };
    await repoRegistrationDone;

    await page.waitForURL(`**${resolveProjectDefaultPath(createdProject.id)}`);
  });
});
