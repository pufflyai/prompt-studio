import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

// Critical: native collection overlays must not return over a retained page or lose its search.
test("Tickets display popup and tooltip dismiss across real app navigation", async ({ page, request }) => {
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Overlay navigation" }),
  });
  expect(created.ok(), await created.text()).toBe(true);
  const project = (await created.json()) as { id: string };
  try {
    await page.goto(`/projects/${project.id}/extensions/pstdio.home/home`);
    const tickets = page.getByRole("option", { name: "Tickets", exact: true });
    const home = page.getByRole("option", { name: "Home", exact: true });
    await tickets.click();
    await page.getByRole("button", { name: "Search this view", exact: true }).click();
    const search = page.getByRole("textbox", { name: "Search this view", exact: true });
    await search.fill("Keep my search");
    const display = page.getByRole("button", { name: "Display settings", exact: true });
    const popup = page.getByRole("dialog").filter({ hasText: "DISPLAY" });
    await display.click();
    await expect(popup).toBeVisible();
    await home.click();
    await expect(popup).toBeHidden();
    await tickets.click();
    await expect(search).toHaveValue("Keep my search");
    await expect(popup).toBeHidden();
    await display.click();
    await expect(popup).toBeVisible();
    await popup.press("Escape");
    await expect(popup).toBeHidden();
    await expect(display).toBeFocused();
    await display.hover();
    const tooltip = page.getByRole("tooltip", { name: "Display", exact: true });
    await expect(tooltip).toBeVisible();
    // Browser Back leaves without moving the pointer off the outgoing trigger.
    await page.goBack();
    await expect(tooltip).toBeHidden();
    await page.goForward();
    await display.hover();
    await expect(tooltip).toBeVisible();
    // Hover does not move keyboard focus; send Escape without synthesizing a new focus/open event.
    await page.keyboard.press("Escape");
    await expect(tooltip).toBeHidden();
  } finally {
    const deleted = await request.delete(`${uiOrigin}/v1/projects/${project.id}`);
    expect(deleted.ok()).toBe(true);
  }
});
