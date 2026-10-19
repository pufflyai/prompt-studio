import { expect, type Page } from "@playwright/test";
import type { Execute } from "./packaged-planner-runtime-fixture";

export const expectImmediateTicketProperty = async (
  page: Page,
  execute: Execute,
  baseUrl: string,
  projectId: string,
) => {
  const ticket = await execute<{ id: string; shorthand: string }>("create-ticket", {
    content: "# Update properties before saving finishes",
  });
  let release = () => {};
  const saving = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pattern = "**/extensions/commands/*/execute";
  const saveStarted = page.waitForRequest((request) => {
    if (request.method() !== "POST" || !request.url().includes("/extensions/commands/")) return false;
    const params = request.postDataJSON()?.params;
    return params?.rowId === ticket.id && params.attributeId === "priority";
  });
  await page.route(pattern, async (route) => {
    const params = route.request().postDataJSON()?.params;
    if (params?.rowId === ticket.id && params.attributeId === "priority") await saving;
    await route.continue();
  });
  try {
    await page.goto(`${baseUrl}/projects/${projectId}/extensions/pstdio.pstdio-planner/tickets`);
    const card = page.getByTestId("renderer-card").filter({ has: page.getByText(ticket.shorthand, { exact: true }) });
    await card.getByRole("button", { name: "Priority", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "High", exact: true }).click();
    await saveStarted;
    await expect(card.getByRole("button", { name: "High", exact: true })).toBeVisible();
    const saved = page.waitForResponse((response) => {
      const params = response.request().postDataJSON()?.params;
      return params?.rowId === ticket.id && params.attributeId === "priority";
    });
    release();
    expect((await saved).ok()).toBe(true);
    await page.reload();
    await expect(card.getByRole("button", { name: "High", exact: true })).toBeVisible();
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    await execute("delete-ticket", { id: ticket.id });
  }
};
