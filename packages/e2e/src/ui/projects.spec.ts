import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const pickerLoadTimeoutMs = 15_000;
const projectCreationTimeoutMs = 25_000;

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

const createTempGitRepo = () => {
  const repoPath = mkdtempSync("/tmp/pstdio-e2e-picker-");
  mkdirSync(join(repoPath, ".git"), { recursive: true });
  return repoPath;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const waitForPickerToLoad = async (dialog: Locator) => {
  await expect(dialog.getByText("Loading...")).not.toBeVisible({ timeout: pickerLoadTimeoutMs });
};

const readPickerPath = async (dialog: Locator) => {
  const path = await dialog.locator("p").filter({ hasText: /^\// }).first().textContent();
  return path?.trim() ?? "/";
};

const navigatePickerToDirectory = async (page: Page, targetPath: string) => {
  const dialog = page.getByRole("dialog").last();
  const parentButton = dialog.getByRole("button", { name: "Go to parent directory" });
  const resolvedTargetPath = realpathSync(targetPath);

  await waitForPickerToLoad(dialog);
  let currentPath = await readPickerPath(dialog);

  while (currentPath !== "/") {
    const previousPath = currentPath;
    await parentButton.click();
    await waitForPickerToLoad(dialog);
    await expect.poll(() => readPickerPath(dialog)).not.toBe(previousPath);
    currentPath = await readPickerPath(dialog);
  }

  for (const segment of resolvedTargetPath.split("/").filter(Boolean)) {
    const expectedPath = currentPath === "/" ? `/${segment}` : `${currentPath}/${segment}`;
    const segmentOption = dialog.getByRole("option", { name: new RegExp(`^${escapeRegex(segment)}$`) }).first();
    await expect(segmentOption).toBeVisible();
    await segmentOption.click();
    await waitForPickerToLoad(dialog);
    await expect.poll(() => readPickerPath(dialog)).toBe(expectedPath);
    currentPath = expectedPath;
  }
};

const selectRepoFromFolderPicker = async (page: Page, repoPath: string) => {
  const repoName = basename(repoPath);
  const dialog = page.getByRole("dialog").last();
  const repoOption = dialog.getByRole("option").filter({ hasText: repoName }).first();

  await page.getByRole("button", { name: "Browse for repository" }).click();
  await navigatePickerToDirectory(page, dirname(repoPath));
  await expect(dialog.getByText("No entries found.")).not.toBeVisible();
  await expect(repoOption).toBeVisible();
  await repoOption.click();
  await dialog.getByRole("button", { name: /Select (Path|repository)/ }).click();
};

test.describe("Project list", () => {
  test.beforeEach(async ({ request }) => {
    test.setTimeout(5_000);
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

  test("navigates to project docs on click", async ({ page, request }) => {
    await bypassOnboarding(page);

    const project = await createProjectViaApi(request, "Nav Test Project");

    await page.goto("/projects");
    await page.getByText("Nav Test Project", { exact: true }).click();

    await page.waitForURL(`**/projects/${project.id}/docs`);
    expect(page.url()).toContain(`/projects/${project.id}/docs`);
  });
});

test.describe("Project creation", () => {
  const tempRepoPaths: string[] = [];

  test.beforeEach(async ({ request }) => {
    test.setTimeout(projectCreationTimeoutMs);
    await deleteAllProjects(request);
  });

  test.afterEach(() => {
    for (const repoPath of tempRepoPaths) {
      rmSync(repoPath, { recursive: true, force: true });
    }
    tempRepoPaths.length = 0;
  });

  test("folder picker shows directory entries", async ({ page }) => {
    const repoPath = createTempGitRepo();
    tempRepoPaths.push(repoPath);
    const repoName = basename(repoPath);
    const dialog = page.getByRole("dialog").last();
    const repoOption = dialog.getByRole("option").filter({ hasText: repoName }).first();

    await bypassOnboarding(page);
    await page.goto("/projects");

    await page.getByRole("button", { name: "Create project" }).first().click();
    await page.getByRole("button", { name: "Browse for repository" }).click();
    await navigatePickerToDirectory(page, dirname(repoPath));

    await expect(dialog.getByText("No entries found.")).not.toBeVisible();
    await expect(repoOption).toBeVisible();
  });

  test("creates a project via the dialog", async ({ page }) => {
    const repoPath = createTempGitRepo();
    tempRepoPaths.push(repoPath);
    const repoName = basename(repoPath);

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
    const createProjectDone = page.waitForResponse(
      (response) =>
        response.url().endsWith("/v1/projects") && response.request().method() === "POST" && response.status() === 201,
    );
    const createProjectButton = page.getByRole("button", { name: "Create project", exact: true }).last();
    await expect(createProjectButton).toBeEnabled();
    await createProjectButton.click();
    const createdProjectResponse = await createProjectDone;
    const createdProject = (await createdProjectResponse.json()) as { id: string };

    await page.waitForURL(`**/projects/${createdProject.id}/docs`);
    expect(page.url()).toContain(`/projects/${createdProject.id}/docs`);
  });

  test("seeds bundled templates when creating a project via the dialog", async ({ page, request }) => {
    const repoPath = createTempGitRepo();
    tempRepoPaths.push(repoPath);

    await bypassOnboarding(page);
    await page.goto("/projects");

    await page.getByRole("button", { name: "Create project" }).first().click();
    await page.getByPlaceholder("Project name").fill("Templates Project");
    await selectRepoFromFolderPicker(page, repoPath);

    const createProjectDone = page.waitForResponse(
      (response) =>
        response.url().endsWith("/v1/projects") && response.request().method() === "POST" && response.status() === 201,
    );
    const createProjectButton = page.getByRole("button", { name: "Create project", exact: true }).last();
    await expect(createProjectButton).toBeEnabled();
    await createProjectButton.click();
    const createdProjectResponse = await createProjectDone;
    const createdProject = (await createdProjectResponse.json()) as { id: string; name: string };

    const templatesResponse = await request.get(`${apiBase}/v1/projects/${createdProject.id}/templates`);
    expect(templatesResponse.ok()).toBe(true);
    const templates = (await templatesResponse.json()) as Array<{ name: string; is_default: boolean }>;

    expect(templates.map((template) => template.name).sort()).toEqual([
      "adr",
      "changelog-entry",
      "commit-message",
      "cookbook",
      "create-sub-tickets",
      "implement-ticket",
      "lessons-learned",
      "prd",
      "proposal",
      "refine-ticket",
      "review-me",
      "squash-message",
      "ticket",
    ]);
    expect(
      templates
        .filter((template) => template.is_default)
        .map((template) => template.name)
        .sort(),
    ).toEqual(["commit-message", "prd", "ticket"]);
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

  test("can create project from empty state CTA", async ({ page }) => {
    const repoPath = createTempGitRepo();
    tempRepoPaths.push(repoPath);

    await bypassOnboarding(page);
    await page.goto("/projects");

    // click the empty-state CTA
    await page.getByRole("button", { name: "Create your first project" }).click();

    // dialog should open
    await expect(page.getByPlaceholder("Project name")).toBeVisible();

    // fill and submit
    await page.getByPlaceholder("Project name").fill("CTA Project");
    await selectRepoFromFolderPicker(page, repoPath);
    const createProjectDone = page.waitForResponse(
      (response) =>
        response.url().endsWith("/v1/projects") && response.request().method() === "POST" && response.status() === 201,
    );
    const createProjectButton = page.getByRole("button", { name: "Create project", exact: true }).last();
    await expect(createProjectButton).toBeEnabled();
    await createProjectButton.click();
    const createdProjectResponse = await createProjectDone;
    const createdProject = (await createdProjectResponse.json()) as { id: string };

    await page.waitForURL(`**/projects/${createdProject.id}/docs`);
    expect(page.url()).toContain(`/projects/${createdProject.id}/docs`);
  });

  test("installs skills in the repo when creating a project with a configured agent", async ({ page, request }) => {
    const repoPath = createTempGitRepo();
    tempRepoPaths.push(repoPath);

    // configure an agent via the API before creating the project
    await configureAgent(request, "opencode");

    await bypassOnboarding(page);
    await page.goto("/projects");

    await page.getByRole("button", { name: "Create project" }).first().click();
    await page.getByPlaceholder("Project name").fill("Skills Project");
    await selectRepoFromFolderPicker(page, repoPath);
    const createProjectDone = page.waitForResponse(
      (response) =>
        response.url().endsWith("/v1/projects") && response.request().method() === "POST" && response.status() === 201,
    );
    const repoRegistrationDone = page.waitForResponse(
      (res) => res.url().includes("/repos") && res.request().method() === "POST" && res.status() === 201,
    );
    const createProjectButton = page.getByRole("button", { name: "Create project", exact: true }).last();
    await expect(createProjectButton).toBeEnabled();
    await createProjectButton.click();
    const createdProjectResponse = await createProjectDone;
    const createdProject = (await createdProjectResponse.json()) as { id: string };

    // Wait for repo registration to complete (skills are installed during this call)
    await repoRegistrationDone;
    await page.waitForURL(`**/projects/${createdProject.id}/docs`);
    expect(page.url()).toContain(`/projects/${createdProject.id}/docs`);

    // verify skills were installed in the repo
    expect(existsSync(join(repoPath, ".opencode", "skills", "create-ticket", "SKILL.md"))).toBe(true);
    expect(existsSync(join(repoPath, ".opencode", "skills", "implement-ticket", "SKILL.md"))).toBe(true);
    expect(existsSync(join(repoPath, ".opencode", "skills", "create-proposal", "SKILL.md"))).toBe(true);
  });
});

test.describe("Project settings hooks", () => {
  test.beforeEach(async ({ request }) => {
    test.setTimeout(15_000);
    await deleteAllProjects(request);
  });

  test("creates a hook from the sidebar dropdown and edits it", async ({ page, request }) => {
    await bypassOnboarding(page);

    const repoPath = createTempGitRepo();
    try {
      const project = await createProjectViaApi(request, "Hooks Settings Project");
      const registerRepoRes = await request.post(`${apiBase}/v1/projects/${project.id}/repos`, {
        data: { name: "hooks-settings-repo", path: repoPath },
      });
      expect(registerRepoRes.ok()).toBe(true);

      await page.goto(`/projects/${project.id}/settings`);

      // The sidebar should show the Hooks section
      const sidebar = page.locator("aside").first();
      await expect(sidebar.getByText("Hooks")).toBeVisible();

      // Reveal the section action buttons and open the add-hook dropdown
      const hooksSection = sidebar.locator("text=Hooks").locator("..");
      await hooksSection.hover();
      const addButton = sidebar.getByRole("button", { name: "Add hook" });
      await expect(addButton).toBeVisible();
      await addButton.click();

      // Select pre-commit from the dropdown
      await page.getByRole("menuitem", { name: "pre-commit" }).click();

      // Should navigate to the hook editor
      await expect(page.getByText("pre-commit").first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Save" })).toBeVisible();

      // Verify the hook was created via API
      const hooksRes = await request.get(`${apiBase}/v1/projects/${project.id}/hooks`);
      expect(hooksRes.ok()).toBe(true);
      const hooks = (await hooksRes.json()) as Array<{ name: string; content: string | null }>;
      const preCommit = hooks.find((h) => h.name === "pre-commit");
      expect(preCommit?.content).toBeTruthy();
    } finally {
      rmSync(repoPath, { recursive: true, force: true });
    }
  });
});
