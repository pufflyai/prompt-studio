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

test.describe("Project settings", () => {
  test("creates a template from the dashboard dialog", async ({ page, request }) => {
    const project = await createProjectViaApi(request, `Template Action ${Date.now()}`);
    const templateName = `blank-template-${Date.now()}`;

    await bypassOnboarding(page);
    await page.goto("/projects");
    await page.getByText(project.name, { exact: true }).click();
    await page.waitForURL(`**/projects/${project.id}/docs`);
    await page.getByRole("option", { name: "Project settings" }).click();
    await page.waitForURL(`**/projects/${project.id}/settings*`);

    await page.getByText("Templates", { exact: true }).hover();
    await page.getByRole("button", { name: "Create template" }).click();

    const createDialog = page.getByRole("dialog").last();
    await expect(createDialog.getByText("Create template", { exact: true })).toBeVisible();
    await createDialog.getByPlaceholder("Template name").fill(templateName);

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/v1/projects/${project.id}/templates`) &&
        response.request().method() === "POST" &&
        response.status() === 201,
    );
    await createDialog.getByRole("button", { name: "Create", exact: true }).click();
    await createResponse;

    await expect(page.getByText(templateName, { exact: true }).first()).toBeVisible();

    const templateResponse = await request.get(
      `${apiBase}/v1/projects/${project.id}/templates/${encodeURIComponent(templateName)}`,
    );
    expect(templateResponse.ok()).toBe(true);
    const template = (await templateResponse.json()) as { content: string; name: string };
    expect(template.name).toBe(templateName);
    expect(template.content).toBe(`# ${templateName}\n`);
  });
});
