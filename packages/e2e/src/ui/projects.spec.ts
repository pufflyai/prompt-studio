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

test.describe("Project list", () => {
  test("shows empty state when no projects exist", async ({ page }) => {
    await bypassOnboarding(page);
    await page.goto("/projects");

    await expect(page.getByText("No projects yet")).toBeVisible();
    await expect(page.getByText("Create your first project")).toBeVisible();
  });

  test("lists projects seeded via API", async ({ page, request }) => {
    await bypassOnboarding(page);

    const projectA = await createProjectViaApi(request, "Alpha Project");
    const projectB = await createProjectViaApi(request, "Beta Project");

    await page.goto("/projects");

    await expect(page.getByText("Alpha Project")).toBeVisible();
    await expect(page.getByText("Beta Project")).toBeVisible();
    await expect(page.getByText(/You have \d+ projects?/)).toBeVisible();

    // cleanup
    await request.delete(`${apiBase}/v1/projects/${projectA.id}`);
    await request.delete(`${apiBase}/v1/projects/${projectB.id}`);
  });

  test("navigates to project tickets on click", async ({ page, request }) => {
    await bypassOnboarding(page);

    const project = await createProjectViaApi(request, "Nav Test Project");

    await page.goto("/projects");
    await page.getByText("Nav Test Project").click();

    await page.waitForURL(`**/projects/${project.id}/tickets`);
    expect(page.url()).toContain(`/projects/${project.id}/tickets`);

    // cleanup
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
  });
});

test.describe("Project creation", () => {
  test("creates a project via the dialog", async ({ page, request }) => {
    await bypassOnboarding(page);
    await page.goto("/projects");

    // open dialog
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByText("Project name")).toBeVisible();

    // fill project name
    await page.getByPlaceholder("Project name").fill("My New Project");

    // add a repository via folder picker
    await page.getByRole("button", { name: "Browse for repository" }).click();
    await page.getByPlaceholder("~/path/to/repository").fill("/tmp/my-repo");
    await page.getByRole("button", { name: "Select Path" }).click();

    // verify repo appears in the dialog
    await expect(page.getByText("my-repo")).toBeVisible();

    // submit
    await page.getByRole("button", { name: "Create project", exact: true }).last().click();

    // verify project appears in the list
    await expect(page.getByText("My New Project")).toBeVisible();

    // cleanup via API
    const res = await request.get(`${apiBase}/v1/projects`);
    const projects = (await res.json()) as { id: string; name: string }[];
    const created = projects.find((p) => p.name === "My New Project");
    if (created) {
      await request.delete(`${apiBase}/v1/projects/${created.id}`);
    }
  });

  test("shows validation errors when submitting empty form", async ({ page }) => {
    await bypassOnboarding(page);
    await page.goto("/projects");

    await page.getByRole("button", { name: "Create project" }).click();

    // click create without filling anything
    const createButtons = page.getByRole("button", { name: "Create project" });
    await createButtons.last().click();

    await expect(page.getByText("Project name is required.")).toBeVisible();
    await expect(page.getByText("Select at least one repository.")).toBeVisible();
  });

  test("can create project from empty state CTA", async ({ page, request }) => {
    await bypassOnboarding(page);
    await page.goto("/projects");

    // click the empty-state CTA
    await page.getByRole("button", { name: "Create your first project" }).click();

    // dialog should open
    await expect(page.getByPlaceholder("Project name")).toBeVisible();

    // fill and submit
    await page.getByPlaceholder("Project name").fill("First Project");
    await page.getByRole("button", { name: "Browse for repository" }).click();
    await page.getByPlaceholder("~/path/to/repository").fill("/tmp/first-repo");
    await page.getByRole("button", { name: "Select Path" }).click();
    await page.getByRole("button", { name: "Create project", exact: true }).last().click();

    await expect(page.getByText("First Project")).toBeVisible();

    // cleanup
    const res = await request.get(`${apiBase}/v1/projects`);
    const projects = (await res.json()) as { id: string; name: string }[];
    const created = projects.find((p) => p.name === "First Project");
    if (created) {
      await request.delete(`${apiBase}/v1/projects/${created.id}`);
    }
  });
});
