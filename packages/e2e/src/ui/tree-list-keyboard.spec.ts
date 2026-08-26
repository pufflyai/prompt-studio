import { expect, type Locator, type Page, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.harness-open-code.harness.opencode");
  });
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, {
    data: { name },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string };
};

const treeItem = (page: Page, name: string): Locator =>
  page
    .getByRole("treeitem", { name, exact: true })
    .or(page.getByRole("option", { name, exact: true }))
    .first();

test("tree lists move focus with arrow keys", async ({ page, request }) => {
  const project = await createProjectViaApi(request, `Tree Keyboard ${Date.now()}`);

  await bypassOnboarding(page);
  await page.goto(`/projects/${project.id}/settings?panel=runtime`);

  const runtime = treeItem(page, "Runtime");
  const extensions = treeItem(page, "Extensions");
  const repositories = treeItem(page, "Repositories");

  await expect(runtime).toBeVisible();
  await runtime.click();
  await expect(runtime).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect(extensions).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect(repositories).toBeFocused();

  await page.keyboard.press("ArrowUp");
  await expect(extensions).toBeFocused();
});
