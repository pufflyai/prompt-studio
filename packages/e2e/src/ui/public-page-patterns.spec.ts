import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page, request }) => {
  const response = await request.post(`http://localhost:${process.env.E2E_API_PORT ?? "3200"}/v1/projects`, {
    data: { name: "Public page patterns" },
  });
  expect(response.ok()).toBe(true);
  const project = await response.json();
  await page.addInitScript((id: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", id);
  }, project.id);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${project.id}`);
});

test("Scribble saves an edit across documents and page navigation", async ({ page }) => {
  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  await sidenav.getByRole("option", { name: "Scribble", exact: true }).click();
  const editor = page.locator('[contenteditable="true"]').first();
  await expect(editor).toContainText("Write something here.");
  await editor.fill("A saved Scribble note");
  await sidenav.getByRole("option", { name: "Ideas note", exact: true }).click();
  await expect(editor).toContainText("Keep your ideas here.");
  await sidenav.getByRole("option", { name: "Welcome note", exact: true }).click();
  await expect(editor).toContainText("A saved Scribble note");
  await sidenav.getByRole("option", { name: "Zipline", exact: true }).click();
  await expect(sidenav.getByRole("option", { name: "Ideas note", exact: true })).toHaveCount(0);
  await sidenav.getByRole("option", { name: "Scribble", exact: true }).click();
  await expect(editor).toContainText("A saved Scribble note");
});

for (const pattern of [
  { name: "Zipline", first: "Design the board", second: "Ship the board", text: "Inspect ship." },
  { name: "Pigeon", first: "Hello from Pigeon", second: "Friday meeting", text: "Meet at ten on Friday." },
]) {
  test(`${pattern.name} updates its reader for the next selection`, async ({ page }) => {
    const sidenav = page.locator('[data-workbench-region="sidenav"]');
    await sidenav.getByRole("option", { name: pattern.name, exact: true }).click();
    await page.getByRole("button", { name: "Open Side Panel", exact: true }).click();
    await page.getByRole("button", { name: "Reattach Side Panel", exact: true }).click();
    const main = page.locator('[data-workbench-region="main"]');
    const side = page.locator('[data-workbench-region="side"]');
    await main.getByText(pattern.first, { exact: true }).click();
    await expect(side.getByRole("heading", { name: pattern.first })).toBeVisible();
    await expect(side.getByRole("tab")).toHaveCount(0);
    await main.getByText(pattern.second, { exact: true }).click();
    await expect(side).toContainText(pattern.text);
    await expect(side.getByRole("heading", { name: pattern.first })).toHaveCount(0);
    await sidenav.getByRole("option", { name: "Scribble", exact: true }).click();
    await expect(side).not.toContainText(pattern.text);
  });
}
