import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket, executePlannerCommand } from "../helpers/planner-api";
import { uiOrigin } from "../ui-server";

test("ticket content opens with pending requests while navigation details are still loading", async ({
  page,
  request,
}) => {
  // Critical risk: review requests or a slow sidebar must not prevent reading the ticket.
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Immediate ticket content" }),
  });
  expect(created.ok()).toBe(true);
  const { id } = await created.json();
  const sidebar = Promise.withResolvers<void>();
  let sidebarRequested = false;
  try {
    const ticket = await createPlannerTicket(request, uiOrigin, id, {
      content: "# Read this ticket\n\nThe description is available before navigation details.",
    });
    await executePlannerCommand(request, uiOrigin, id, "request-review", {
      ticket: ticket.id,
      title: "Confirm the change",
      instructions: "Check the proposed behavior.",
      request: { kind: "task" },
    });
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await page.goto(`/projects/${id}/extensions/pstdio.pstdio-planner/tickets`);
    const card = page.getByTestId("renderer-card").filter({ hasText: ticket.title }).first();
    await expect(card).toBeVisible();
    await page.route(/ticket-files.*\/execute/, async (route) => {
      sidebarRequested = true;
      await sidebar.promise;
      await route.continue();
    });
    await card.getByText(ticket.title, { exact: true }).click();
    await expect(page).toHaveURL(/\/ticket\?resource=/);
    await expect.poll(() => sidebarRequested).toBe(true);
    await expect(page.getByTestId("content-editable").filter({ visible: true }).first()).toContainText(
      "The description is available before navigation details.",
    );
    sidebar.resolve();
    await page.unrouteAll({ behavior: "wait" });
    await page.getByRole("option", { name: /Needs attention/ }).click();
    await expect(page).toHaveURL(/\/ticket-requests\?resource=/);
    await expect(
      page
        .getByRole("region", { name: "Main", exact: true })
        .frameLocator("iframe")
        .getByText("Confirm the change", { exact: true }),
    ).toBeVisible();
  } finally {
    sidebar.resolve();
    await page.unrouteAll({ behavior: "wait" });
    await request.delete(`${uiOrigin}/v1/projects/${id}`);
  }
});
