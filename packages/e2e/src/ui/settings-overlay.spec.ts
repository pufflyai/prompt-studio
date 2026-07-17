import { expect, type Page, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (page: Page, projectId: string) => {
  await page.addInitScript((selectedProjectId) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
  }, projectId);
};

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/projects`);
  expect(response.ok()).toBe(true);
  const projects = (await response.json()) as { id: string }[];
  for (const project of projects) {
    const deleteResponse = await request.delete(`${apiBase}/v1/projects/${project.id}`);
    expect(deleteResponse.ok()).toBe(true);
  }
};

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "Global Settings Overlay Project" },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const getFrameGeometry = async (page: Page) => ({
  left: await page.locator('[aria-label="left"]').boundingBox(),
  main: await page.locator('[aria-label="main"]').boundingBox(),
});

const openSettings = async (page: Page) => {
  await page.keyboard.press("ControlOrMeta+KeyK");
  const paletteInput = page.getByPlaceholder("Search resources");
  await expect(paletteInput).toBeVisible();
  await paletteInput.fill("> Open settings");
  await page.getByText("Open settings", { exact: true }).click();
  const dialog = page.getByRole("dialog").filter({ has: page.getByRole("region", { name: "Settings" }) });
  await expect(dialog).toBeVisible();
  return dialog;
};

test("settings preserves the frame in project and sessions modes", async ({ page, request }) => {
  test.setTimeout(20_000);
  await deleteAllProjects(request);
  const project = await createProject(request);
  await bypassOnboarding(page, project.id);
  await page.goto(`/projects/${project.id}/tickets`);
  await expect(page.getByRole("option", { name: "Tickets", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open session" }).click();

  const sidePanel = page.getByTestId("workbench-side-panel-docked");
  await expect(sidePanel).toBeVisible();
  const projectGeometry = await getFrameGeometry(page);
  const projectSettings = await openSettings(page);
  expect(await getFrameGeometry(page)).toEqual(projectGeometry);
  await expect(sidePanel).toBeVisible();
  await projectSettings.getByRole("button", { name: /^Close/ }).click();
  await expect(projectSettings).not.toBeVisible();
  expect(await getFrameGeometry(page)).toEqual(projectGeometry);
  await expect(sidePanel).toBeVisible();

  await page.getByRole("option", { name: "Sessions", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No messages yet" })).toBeVisible();
  await expect(sidePanel).not.toBeVisible();
  const sessionsUrl = page.url();
  const sessionsGeometry = await getFrameGeometry(page);
  const sessionsSettings = await openSettings(page);
  expect(await getFrameGeometry(page)).toEqual(sessionsGeometry);
  await sessionsSettings.getByRole("button", { name: /^Close/ }).click();
  await expect(sessionsSettings).not.toBeVisible();
  expect(await getFrameGeometry(page)).toEqual(sessionsGeometry);
  expect(page.url()).toBe(sessionsUrl);
});
