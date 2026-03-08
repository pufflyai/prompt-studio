import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

test("API health check responds ok", async ({ request }) => {
  test.setTimeout(5_000);
  const response = await request.get(`${apiBase}/healthz`);

  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.ok).toBe(true);
});

test("dashboard loads successfully", async ({ page }) => {
  test.setTimeout(5_000);
  await page.goto("/");

  await expect(page.locator("body")).toBeVisible();
  // The dashboard SPA should render without a hard error
  await expect(page.locator("text=Not found")).not.toBeVisible();
});
