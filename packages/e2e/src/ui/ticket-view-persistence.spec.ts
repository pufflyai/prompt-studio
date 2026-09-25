import { expect, test } from "@playwright/test";

// Browser persistence keeps the same profile; desktop profile persistence is covered
// separately because its renderer session and runtime origin are temporary.
test("keeps named ticket views after reload and reopening a page", async ({ page, context, request }) => {
  const response = await request.post("/v1/projects", { data: { name: "Ticket view persistence" } });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  const path = `/projects/${project.id}/extensions/pstdio.pstdio-planner/tickets`;
  await context.addInitScript((projectId) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);
  try {
    await page.goto(path);
    await page.getByRole("button", { name: "Add view", exact: true }).click();
    await page.getByRole("tab", { name: "View 2", exact: true }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
    await page.getByRole("textbox", { name: "View name" }).fill("Restart check");
    await page.getByRole("button", { name: "Rename", exact: true }).click();
    await page.reload();
    await expect(page.getByRole("tab", { name: "Restart check", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto(path);
    await expect(reopened.getByRole("tab", { name: "Restart check", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await reopened.getByRole("tab", { name: "Restart check", exact: true }).click({ button: "right" });
    await reopened.getByRole("menuitem", { name: "Delete view", exact: true }).click();
    await reopened.reload();
    await expect(reopened.getByRole("tab", { name: "All", exact: true })).toBeVisible();
    await expect(reopened.getByRole("tab", { name: "Restart check", exact: true })).toHaveCount(0);
  } finally {
    await request.delete(`/v1/projects/${project.id}`);
  }
});
