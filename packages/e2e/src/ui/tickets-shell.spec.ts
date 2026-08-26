import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.harness.fake");
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

test.describe("Tickets shell", () => {
  let projectId: string;

  test.beforeEach(async ({ request }) => {
    test.setTimeout(10_000);
    await deleteAllProjects(request);
    const project = await createProjectViaApi(request, "Tickets Shell Project");
    projectId = project.id;
  });

  test("keeps project navigation, footer commands, and a single main surface", async ({ page }) => {
    await bypassOnboarding(page);
    await page.goto(`/projects/${projectId}/tickets`);

    await expect(page.getByRole("button", { name: /Tickets Shell Project/ })).toBeVisible();
    await expect(page.getByText("Search", { exact: true })).toBeVisible();
    await expect(page.getByText("Help", { exact: true })).toBeVisible();
    await expect(page.getByText("Sessions", { exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Tickets" })).toHaveCount(0);

    await page.getByText("Search", { exact: true }).click();
    await expect(page.getByPlaceholder("Search or type > for commands")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByText("Help", { exact: true }).click();
    await expect(page.locator("text=Keyboard Shortcuts").first()).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByText("Sessions", { exact: true }).click();
    await page.waitForURL(`**/projects/${projectId}/sessions`);
  });
});
