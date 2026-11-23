import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket, listPlannerTickets } from "../helpers/planner-api";
import { uiOrigin } from "../ui-server";

test("keeps a submitted ticket unresolved if the server commits and its response is lost", async ({
  page,
  request,
}) => {
  const project = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Uncertain ticket creation" }),
  });
  expect(project.ok()).toBe(true);
  const { id } = (await project.json()) as { id: string };
  const title = "Confirm the project setup";
  const content = title;
  try {
    await createPlannerTicket(request, uiOrigin, id, { content });
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await page.goto(`/projects/${id}/`);
    await page.getByRole("option", { name: "Tickets", exact: true }).click();
    const boardUrl = page.url();
    const add = page.getByRole("button", { name: "Create row", exact: true }).first();
    await add.click();
    const form = page.getByRole("dialog", { name: "New ticket", exact: true });
    await form.locator('[contenteditable="true"]').first().fill(content);
    const matchingRequests = "**/extensions/commands/pstdio.planner.command.create-ticket/execute";
    const committed = Promise.withResolvers<void>();
    let writes = 0;
    await page.route(matchingRequests, async (route) => {
      writes++;
      try {
        const response = await route.fetch();
        expect(response.ok()).toBe(true);
        expect((await response.json()).outcome.ok).toBe(true);
        committed.resolve();
      } catch (error) {
        committed.reject(error);
      } finally {
        await route.abort("failed");
      }
    });
    const submit = form.getByRole("button", { name: "Create ticket", exact: true });
    const unresolved = form.getByText("Creation could not be confirmed.", { exact: true });
    await submit.click();
    await committed.promise;
    await expect(unresolved).toBeVisible();
    await expect(submit).toBeDisabled();
    await expect(form.getByRole("button", { name: "Check again" })).toHaveCount(0);
    await expect(form.getByRole("button", { name: "Copy draft" })).toBeEnabled();
    expect((await listPlannerTickets(request, uiOrigin, id)).filter((ticket) => ticket.title === title)).toHaveLength(
      2,
    );
    await expect(page).toHaveURL(boardUrl);
    await form.getByRole("button", { name: "Inspect resources" }).click();
    await expect(form).toBeHidden();
    await expect(page.locator('[data-status-bar-item="workbench.system-activity"]')).toBeVisible();
    await add.click();
    await expect(unresolved).toBeVisible();
    await expect(submit).toBeDisabled();
    await form.getByRole("button", { name: "Discard draft" }).click();
    await expect(form).toBeHidden();
    expect(writes).toBe(1);
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${id}`);
  }
});
