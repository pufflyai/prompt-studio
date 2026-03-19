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

const createTemplateViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  name: string,
) => {
  const res = await request.post(`${apiBase}/v1/projects/${projectId}/templates`, {
    data: { name, template_type: "prompt" },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string; content: string };
};

const navigateToTemplate = async (page: import("@playwright/test").Page, projectId: string, templateName: string) => {
  await bypassOnboarding(page);
  await page.goto(`/projects/${projectId}/settings`);
  await page.getByText("Templates", { exact: true }).click();
  await page.getByText("Prompts", { exact: true }).click();
  await page.getByText(templateName, { exact: true }).click();
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

    await page.getByText("Templates", { exact: true }).click();
    await page.getByText("Prompts", { exact: true }).click();
    await expect(page.getByText(templateName, { exact: true }).first()).toBeVisible();

    const templateResponse = await request.get(
      `${apiBase}/v1/projects/${project.id}/templates/${encodeURIComponent(templateName)}`,
    );
    expect(templateResponse.ok()).toBe(true);
    const template = (await templateResponse.json()) as { content: string; name: string };
    expect(template.name).toBe(templateName);
    expect(template.content).toBe(`# ${templateName}\n`);
  });

  test("saves edited template content", async ({ page, request }) => {
    const project = await createProjectViaApi(request, `Save Flow ${Date.now()}`);
    const templateName = `save-test-${Date.now()}`;
    await createTemplateViaApi(request, project.id, templateName);

    await navigateToTemplate(page, project.id, templateName);

    const editor = page.locator("[data-lexical-editor]").first();
    await editor.click();
    await editor.pressSequentially("Updated content");

    const saveButton = page.getByRole("button", { name: "Save", exact: true });
    await expect(saveButton).toBeEnabled();

    const saveResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/v1/projects/${project.id}/templates`) &&
        response.request().method() === "PUT" &&
        response.status() === 200,
    );
    await saveButton.click();
    await saveResponse;

    const templateResponse = await request.get(
      `${apiBase}/v1/projects/${project.id}/templates/${encodeURIComponent(templateName)}`,
    );
    expect(templateResponse.ok()).toBe(true);
    const template = (await templateResponse.json()) as { content: string };
    expect(template.content).toContain("Updated content");
  });

  test("cancel reverts editor to saved content", async ({ page, request }) => {
    const project = await createProjectViaApi(request, `Cancel Flow ${Date.now()}`);
    const templateName = `cancel-test-${Date.now()}`;
    await createTemplateViaApi(request, project.id, templateName);

    await navigateToTemplate(page, project.id, templateName);

    const editor = page.locator("[data-lexical-editor]").first();
    await editor.click();
    await editor.pressSequentially("Unsaved changes");

    const cancelButton = page.getByRole("button", { name: "Cancel", exact: true });
    await expect(cancelButton).toBeEnabled();
    await cancelButton.click();

    await expect(cancelButton).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await expect(editor).not.toContainText("Unsaved changes");
  });

  test("cancel and save are disabled when no changes are made", async ({ page, request }) => {
    const project = await createProjectViaApi(request, `Disabled Buttons ${Date.now()}`);
    const templateName = `disabled-test-${Date.now()}`;
    await createTemplateViaApi(request, project.id, templateName);

    await navigateToTemplate(page, project.id, templateName);

    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  });
});
