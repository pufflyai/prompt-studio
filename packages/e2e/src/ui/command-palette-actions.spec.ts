import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
  });
};

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  const projects = (await res.json()) as { id: string }[];
  for (const p of projects) {
    await request.delete(`${apiBase}/v1/projects/${p.id}`);
  }
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, { data: { name } });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string };
};

test.describe("Command palette follow-up modals", () => {
  let projectId: string;

  test.beforeEach(async ({ request }) => {
    test.setTimeout(15_000);
    await deleteAllProjects(request);
    const project = await createProjectViaApi(request, "Command Palette Modal Project");
    projectId = project.id;
  });

  test("opening keyboard shortcuts from the palette keeps the help dialog open", async ({ page }) => {
    await bypassOnboarding(page);
    await page.goto(`/projects/${projectId}/tickets`);

    await page.keyboard.press("ControlOrMeta+KeyK");

    const paletteInput = page.getByPlaceholder("Search or type > for commands");
    await expect(paletteInput).toBeVisible();

    await paletteInput.fill("> keyboard");
    await page.locator("text=Keyboard shortcuts").first().click();

    const helpHeading = page.locator("text=Keyboard Shortcuts").first();
    await expect(helpHeading).toBeVisible();
    await page.waitForTimeout(500);
    await expect(helpHeading).toBeVisible();
  });

  test("opening create ticket from the palette keeps the create modal open", async ({ page }) => {
    await bypassOnboarding(page);
    await page.goto(`/projects/${projectId}/tickets`);

    await page.keyboard.press("ControlOrMeta+KeyK");

    const paletteInput = page.getByPlaceholder("Search or type > for commands");
    await expect(paletteInput).toBeVisible();

    await paletteInput.fill("> create ticket");
    await page.locator("text=Create ticket").first().click();

    const createModalHeader = page.getByText(/new ticket|create ticket/i).first();
    await expect(createModalHeader).toBeVisible();
    await page.waitForTimeout(500);
    await expect(createModalHeader).toBeVisible();
  });
});
