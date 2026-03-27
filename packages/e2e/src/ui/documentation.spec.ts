import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "fake");
  });
};

const configureAgent = async (request: import("@playwright/test").APIRequestContext, agentId: string) => {
  const res = await request.post(`${apiBase}/v1/agents`, {
    data: { agent_id: agentId },
  });
  expect(res.ok()).toBe(true);
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

const expandDocumentationSection = async (page: import("@playwright/test").Page) => {
  const sectionHeader = page.getByText("Documentation", { exact: true }).first();
  await sectionHeader.click();
};

test.describe("Documentation", () => {
  let repoDir: string;

  test.beforeEach(() => {
    test.setTimeout(10_000);
    repoDir = setupDocsRepo();
  });

  test.afterEach(async ({ request }) => {
    await deleteAllProjects(request);
    rmSync(repoDir, { recursive: true, force: true });
  });

  test("shows empty state when project has no docs", async ({ page, request }) => {
    await bypassOnboarding(page);
    await configureAgent(request, "fake");

    const emptyRepoDir = join(tmpdir(), `pstdio-e2e-empty-${Date.now()}`);
    mkdirSync(emptyRepoDir, { recursive: true });

    const project = await createProjectWithDocs(request, emptyRepoDir);

    await page.goto(`/projects/${project.id}/docs`);
    await expect(page.getByRole("heading", { name: "Setup your project documentation" })).toBeVisible();
    await expect(page.getByText("Ask your agent to setup your project documentation.")).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Create documentation in .pstdio/docs describing what this repo owns and what is out of scope.",
      }),
    ).toBeVisible();

    rmSync(emptyRepoDir, { recursive: true, force: true });
  });

  test("starts a new session from a documentation prompt suggestion", async ({ page, request }) => {
    await bypassOnboarding(page);
    await configureAgent(request, "fake");

    const emptyRepoDir = join(tmpdir(), `pstdio-e2e-empty-${Date.now()}`);
    mkdirSync(emptyRepoDir, { recursive: true });

    const project = await createProjectWithDocs(request, emptyRepoDir);
    const prompt = "Create documentation in .pstdio/docs describing what this repo owns and what is out of scope.";

    await page.goto(`/projects/${project.id}/docs`);
    await page.getByRole("button", { name: prompt }).click();

    // Session should open as a bubble overlay, not navigate to the session page
    await expect(page.getByText(prompt).first()).toBeVisible();
    await expect(page.getByText(`Fake Agent: completed "${prompt}"`).first()).toBeVisible();

    rmSync(emptyRepoDir, { recursive: true, force: true });
  });

  test("displays docs sidebar with navigation items", async ({ page, request }) => {
    await bypassOnboarding(page);

    const project = await createProjectWithDocs(request, repoDir);

    await page.goto(`/projects/${project.id}/docs`);

    // Expand the Documentation section in the sidebar
    await expandDocumentationSection(page);

    const sidebar = page.locator("aside");
    await expect(sidebar.getByText("Welcome")).toBeVisible();
    await expect(sidebar.getByText("Getting Started")).toBeVisible();
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

    // Expand the Documentation section and click "Getting Started"
    await expandDocumentationSection(page);
    await page.getByText("Getting Started").click();

    // Verify content changed
    await expect(page.getByText("Follow these steps to begin.")).toBeVisible();
  });

  test("navigates to docs tab from project sidebar", async ({ page, request }) => {
    await bypassOnboarding(page);

    const project = await createProjectWithDocs(request, repoDir);

    // Start on tickets page
    await page.goto(`/projects/${project.id}/tickets`);

    // Expand the Documentation section and click a doc item
    await expandDocumentationSection(page);
    await page.getByText("Welcome").click();

    await page.waitForURL(`**/projects/${project.id}/docs**`);
    await expect(page.getByText("This is the main documentation page.")).toBeVisible();
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

  test("renders changelog template as timeline instead of markdown", async ({ page, request }) => {
    const changelogDir = join(repoDir, ".pstdio", "docs");

    writeFileSync(
      join(changelogDir, "changelog.md"),
      [
        "# Changelog",
        "",
        "Latest updates.",
        "",
        "---",
        "",
        "## 1.0.0",
        "",
        "**Date:** Mar 20, 2026",
        "**Title:** First release",
        "",
        "### Changes",
        "",
        "- **Feature A** — The first feature.",
      ].join("\n"),
    );

    writeFileSync(
      join(changelogDir, "navigation.json"),
      JSON.stringify({
        sidebar: [
          { text: "Welcome", link: "index" },
          { text: "Changelog", link: "/changelog", template: "changelog" },
        ],
      }),
    );

    const project = await createProjectWithDocs(request, repoDir);

    await bypassOnboarding(page);
    await page.goto(`/projects/${project.id}/docs?doc=/changelog`);

    await expect(page.getByText("Changelog")).toBeVisible();
    await expect(page.getByText("First release")).toBeVisible();
    await expect(page.getByText("Feature A")).toBeVisible();
  });
});
