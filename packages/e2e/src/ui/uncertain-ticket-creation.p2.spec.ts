import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket, listPlannerTickets } from "../helpers/planner-api";
import { uiOrigin } from "../ui-server";

for (const dismiss of [false, true]) {
  test(
    dismiss
      ? "closing the saving form keeps the board open when the ticket is saved"
      : "create and open moves from the saving form directly to the saved ticket",
    async ({ page, request }) => {
      const project = await request.post(`${uiOrigin}/v1/projects`, {
        data: folderProjectInput({ name: "Open saved ticket" }),
      });
      expect(project.ok()).toBe(true);
      const { id } = (await project.json()) as { id: string };
      const title = "Open the saved ticket";
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      try {
        await createPlannerTicket(request, uiOrigin, id, { title: "Existing ticket" });
        await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
        const board = `/projects/${id}/extensions/pstdio.planner/tickets`;
        await page.goto(board);
        const add = page.getByRole("button", { name: "Create row", exact: true }).first();
        await add.click();
        const form = page.getByRole("dialog", { name: "New ticket", exact: true });
        await form.locator('[contenteditable="true"]').first().fill(title);
        await page.route("**/extensions/commands/pstdio.planner.command.create-ticket/execute", async (route) => {
          entered.resolve();
          await release.promise;
          await route.continue();
        });
        let activations = 0;
        await page.route("**/extensions/commands/pstdio.planner.view.tickets.kanban.onRowActivate/execute", (route) => {
          activations++;
          return route.continue();
        });
        await form.getByRole("button", { name: "Create ticket", exact: true }).click();
        await entered.promise;
        await expect(form).toBeVisible();
        await expect(page.getByTestId("pending-board-creation")).toHaveCount(0);
        if (dismiss) {
          await page.keyboard.press("Escape");
          await expect(form).toBeHidden();
          await add.click();
          await expect(form.getByRole("button", { name: "Create ticket", exact: true })).toBeDisabled();
        }
        release.resolve();
        if (dismiss) {
          await expect(form.locator('[contenteditable="true"]').first()).toHaveText("");
          await page.keyboard.press("Escape");
          await expect(form).toBeHidden();
          await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
          await expect(page).toHaveURL(board);
        } else {
          await expect(page).toHaveURL(/\/extensions\/pstdio\.planner\/ticket\?resource=/);
          await expect(form).toBeHidden();
          await expect(page.locator('[contenteditable="true"]').filter({ hasText: title }).first()).toBeVisible();
        }
        expect(activations).toBe(0);
      } finally {
        release.resolve();
        await request.delete(`${uiOrigin}/v1/projects/${id}`);
      }
    },
  );
}

for (const open of [false, true]) {
  test(`keeps a submitted ticket unresolved after losing the create response (${open ? "create and open" : "stay on the board"})`, async ({
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
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const committed = Promise.withResolvers<void>();
      let writes = 0;
      await page.route(matchingRequests, async (route) => {
        writes++;
        entered.resolve();
        await release.promise;
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
      const label = open ? "Create ticket" : "Create without opening";
      if (!open) {
        await form.getByRole("button", { name: label, exact: true }).click();
        await page.getByRole("menuitemradio", { name: label, exact: true }).click();
      }
      const submit = form.getByRole("button", { name: label, exact: true }).first();
      const unresolved = form.getByText("Creation could not be confirmed.", { exact: true });
      const pending = page.getByTestId("pending-board-creation");
      try {
        await submit.click();
        await entered.promise;
        if (open) {
          await expect(form).toBeVisible();
          await expect(pending).toHaveCount(0);
        } else {
          await expect(form).toBeHidden();
          await expect(pending.getByText(title, { exact: true })).toBeVisible();
          await expect(pending.locator('[draggable="true"], [role="button"], a, button')).toHaveCount(0);
        }
      } finally {
        release.resolve();
      }
      await committed.promise;
      if (open) {
        await expect(unresolved).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(form).toBeHidden();
      }
      await expect(pending.getByText("Creation unconfirmed", { exact: true })).toBeVisible();
      expect((await listPlannerTickets(request, uiOrigin, id)).filter((ticket) => ticket.title === title)).toHaveLength(
        2,
      );
      await expect(page).toHaveURL(boardUrl);
      await page.locator('[data-status-bar-item="workbench.system-activity"]').click();
      await expect(page.getByRole("button", { name: "Inspect resources", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Copy draft", exact: true })).toBeEnabled();
      await expect(page.getByRole("button", { name: "Check again" })).toHaveCount(0);
      await page.keyboard.press("Escape");
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
}

test("a delayed palette creation leaves the page selected after submission open", async ({ page, request }) => {
  const project = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Palette ticket creation" }),
  });
  expect(project.ok()).toBe(true);
  const { id } = (await project.json()) as { id: string };
  const title = "Keep the selected page";
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const createRoute = "**/extensions/commands/pstdio.planner.command.create-ticket/execute";
  try {
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await page.goto(`/projects/${id}/`);
    const tickets = page.getByRole("option", { name: "Tickets", exact: true });
    await expect(tickets).toBeVisible();
    await page.keyboard.press("ControlOrMeta+KeyP");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await palette.getByRole("textbox").fill("> Create ticket");
    await palette.getByText("Create ticket", { exact: true }).click();
    const form = page.getByRole("dialog", { name: "New ticket", exact: true });
    await form.locator('[contenteditable="true"]').first().fill(title);
    await page.route(createRoute, async (route) => {
      entered.resolve();
      await release.promise;
      await route.continue();
    });
    const response = page.waitForResponse(createRoute);
    await form.getByRole("button", { name: "Create ticket", exact: true }).click();
    await entered.promise;
    await expect(form).toBeHidden();
    await tickets.click();
    await expect(page).toHaveURL(/\/extensions\/pstdio\.planner\/tickets$/);
    const boardUrl = page.url();
    release.resolve();
    expect((await response).ok()).toBe(true);
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect(page).toHaveURL(boardUrl);
    expect((await listPlannerTickets(request, uiOrigin, id)).filter((ticket) => ticket.title === title)).toHaveLength(
      1,
    );
  } finally {
    release.resolve();
    await request.delete(`${uiOrigin}/v1/projects/${id}`);
  }
});
