import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "opencode");
  });
};

const createProjectWithDocs = async (request: import("@playwright/test").APIRequestContext, repoPath: string) => {
  const createRes = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "Docs E2E Project" },
  });
  expect(createRes.ok()).toBe(true);
  const project = (await createRes.json()) as { id: string };

  const repoRes = await request.post(`${apiBase}/v1/projects/${project.id}/repos`, {
    data: { name: "docs-repo", path: repoPath },
  });
  expect(repoRes.ok()).toBe(true);

  return project;
};

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  const projects = (await res.json()) as { id: string }[];
  for (const p of projects) {
    await request.delete(`${apiBase}/v1/projects/${p.id}`);
  }
};

const setupDocsRepo = () => {
  const repoDir = join(tmpdir(), `pstdio-e2e-docs-${Date.now()}`);
  const docsDir = join(repoDir, ".pstdio", "docs");
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(join(docsDir, "index.md"), "# Welcome\n\nThis is the main documentation page.");
  writeFileSync(join(docsDir, "getting-started.md"), "# Getting Started\n\nFollow these steps to begin.");
  writeFileSync(
    join(docsDir, "navigation.json"),
    JSON.stringify({
      sidebar: [
        { text: "Welcome", link: "index" },
        { text: "Getting Started", link: "getting-started" },
      ],
    }),
  );

  return repoDir;
};

test.describe("Documentation", () => {
  let repoDir: string;

  test.beforeEach(() => {
    repoDir = setupDocsRepo();
  });

  test.afterEach(async ({ request }) => {
    await deleteAllProjects(request);
    rmSync(repoDir, { recursive: true, force: true });
  });

  test("shows empty state when project has no docs", async ({ page, request }) => {
    await bypassOnboarding(page);

    const emptyRepoDir = join(tmpdir(), `pstdio-e2e-empty-${Date.now()}`);
    mkdirSync(emptyRepoDir, { recursive: true });

    const project = await createProjectWithDocs(request, emptyRepoDir);

    await page.goto(`/projects/${project.id}/docs`);
    await expect(page.getByText("No docs found")).toBeVisible();

    rmSync(emptyRepoDir, { recursive: true, force: true });
  });

  test("displays docs sidebar with navigation items", async ({ page, request }) => {
    await bypassOnboarding(page);

    const project = await createProjectWithDocs(request, repoDir);

    await page.goto(`/projects/${project.id}/docs`);

    await expect(page.getByRole("option", { name: "Welcome" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Getting Started" })).toBeVisible();
  });

  test("displays doc content when a sidebar item is active", async ({ page, request }) => {
    await bypassOnboarding(page);

    const project = await createProjectWithDocs(request, repoDir);

    await page.goto(`/projects/${project.id}/docs`);

    await expect(page.getByText("This is the main documentation page.")).toBeVisible();
  });

  test("switches content when clicking a different sidebar item", async ({ page, request }) => {
    await bypassOnboarding(page);

    const project = await createProjectWithDocs(request, repoDir);

    await page.goto(`/projects/${project.id}/docs`);

    // Wait for initial content to load
    await expect(page.getByText("This is the main documentation page.")).toBeVisible();

    // Click "Getting Started" in the sidebar
    await page.getByText("Getting Started").click();

    // Verify content changed
    await expect(page.getByText("Follow these steps to begin.")).toBeVisible();
  });

  test("navigates to docs tab from project sidebar", async ({ page, request }) => {
    await bypassOnboarding(page);

    const project = await createProjectWithDocs(request, repoDir);

    // Start on tickets page
    await page.goto(`/projects/${project.id}/tickets`);

    // Click the Documentation sidebar nav item
    await page.getByLabel("Documentation").click();

    await page.waitForURL(`**/projects/${project.id}/docs**`);
    await expect(page.getByRole("option", { name: "Welcome" })).toBeVisible();
  });

  test("docs API returns correct index", async ({ request }) => {
    const project = await createProjectWithDocs(request, repoDir);

    const res = await request.get(`${apiBase}/v1/projects/${project.id}/docs`);
    expect(res.ok()).toBe(true);

    const body = await res.json();
    expect(body.sidebar).toHaveLength(2);
    expect(body.sidebar[0].text).toBe("Welcome");
    expect(body.sidebar[1].text).toBe("Getting Started");
  });

  test("docs API returns correct content", async ({ request }) => {
    const project = await createProjectWithDocs(request, repoDir);

    const res = await request.get(`${apiBase}/v1/projects/${project.id}/docs/content?link=getting-started`);
    expect(res.ok()).toBe(true);

    const body = await res.json();
    expect(body.content).toContain("# Getting Started");
    expect(body.path).toBe("getting-started.md");
  });

  test("docs API returns 404 for nonexistent document", async ({ request }) => {
    const project = await createProjectWithDocs(request, repoDir);

    const res = await request.get(`${apiBase}/v1/projects/${project.id}/docs/content?link=nonexistent`);
    expect(res.status()).toBe(404);
  });
});
