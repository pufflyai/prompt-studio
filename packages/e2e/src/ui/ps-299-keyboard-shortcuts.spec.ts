import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

test("PS-299 lists every registered keyboard shortcut", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "PS-299 Keyboard Shortcuts" },
  });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };

  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.harness.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
  }, project.id);
  await page.goto(`/projects/${project.id}/tickets`);
  await expect(page.getByRole("option", { name: "Tickets", exact: true }).first()).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Help", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Keyboard shortcuts/ }).click();

  await expect(page.getByText("Keyboard shortcuts", { exact: true }).last()).toBeVisible();
  for (const label of [
    "Toggle Command Palette",
    "Run Command",
    "Change Theme",
    "Navigate Back",
    "Navigate Forward",
    "Toggle Sidenav",
    "Open notifications",
    "Keyboard shortcuts",
    "Say hello",
  ]) {
    await expect(page.getByText(label, { exact: true }).last()).toBeVisible();
  }
});
