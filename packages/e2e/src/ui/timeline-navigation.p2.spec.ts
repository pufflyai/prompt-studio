import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

test("returning to the timeline after creating a ticket refreshes without a closed-viewer error", async ({
  page,
  request,
}) => {
  // Critical risk: a retained timeline must refresh after ticket creation without a failed background read.
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Timeline navigation" }),
  });
  expect(created.ok()).toBe(true);
  const { id } = await created.json();
  try {
    await page.addInitScript(() => {
      if (window !== window.top) return;
      localStorage.setItem("onboarding-complete", "true");
      const errors: string[] = [];
      Object.assign(window, { timelineViewerErrors: errors });
      new MutationObserver(() => {
        const message = "The calling viewer is no longer open";
        if (document.body?.textContent?.includes(message)) errors.push(message);
      }).observe(document, { subtree: true, childList: true, characterData: true });
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const timelinePath = `/projects/${id}/extensions/pstdio.planner/ticket-timeline`;
    await page.goto(`/projects/${id}`);
    const sidenav = page.locator('[data-workbench-region="sidenav"]');
    const ticketsEntry = sidenav.getByRole("option", { name: "Tickets", exact: true });
    const timelineEntry = sidenav.getByRole("option", { name: "Project Timeline", exact: true });
    await ticketsEntry.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Hide/show items", exact: true }).click();
    const planning = page.getByRole("dialog", { name: "Hide/show items" }).getByRole("list", {
      name: "Project Planning",
      exact: true,
    });
    const showTimeline = planning.getByRole("button", { name: "Show Project Timeline", exact: true });
    await expect(showTimeline).toBeVisible();
    await expect(timelineEntry).toHaveCount(0);
    await showTimeline.click();
    await page.keyboard.press("Escape");
    await expect(timelineEntry).toBeVisible();
    await page.reload();
    await timelineEntry.click();
    await expect(page).toHaveURL(timelinePath);
    const timeline = page.frameLocator('iframe[title="Project Timeline"]');
    await expect(
      page
        .frameLocator('iframe[title="Timeline actions"]:visible')
        .getByRole("button", { name: "Auto Build", exact: true }),
    ).toBeVisible();
    await page.getByRole("option", { name: "Tickets", exact: true }).click();
    await page.getByRole("button", { name: "Create row", exact: true }).first().click();
    const form = page.getByRole("dialog").last();
    await form.locator('[contenteditable="true"]').first().fill("Created before returning to the timeline");
    await form.getByRole("button", { name: "Create ticket", exact: true }).click();
    await expect(form).toBeHidden();
    await page.getByRole("button", { name: "Back to project", exact: true }).click();
    await timelineEntry.click();
    await expect(timeline.getByText("Created before returning to the timeline", { exact: true })).toBeVisible();
    await expect(page.getByText("The calling viewer is no longer open", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => Reflect.get(window, "timelineViewerErrors"))).toEqual([]);
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${id}`);
  }
});

test("Auto Build stays in the timeline header and opens a host dialog after a panel move", async ({
  page,
  request,
}) => {
  // Critical risk: header webviews must not clip the configuration dialog or lose their owner when moved.
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Timeline header" }),
  });
  expect(created.ok()).toBe(true);
  const { id } = await created.json();
  try {
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await page.setViewportSize({ width: 1440, height: 700 });
    const path = `/projects/${id}/extensions/pstdio.planner/ticket-timeline`;
    await page.goto(path);
    const main = page.locator('[data-workbench-panel="main"]');
    const actions = main
      .locator('[data-workbench-panel-header="main"]')
      .frameLocator('iframe[title="Timeline actions"]');
    await actions.getByRole("button", { name: "Auto Build", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Auto Build", exact: true });
    await expect(dialog).toBeVisible();
    const form = dialog.frameLocator('iframe[title="Auto Build"]');
    await expect(form.getByText("Eligible tickets", { exact: true })).toBeVisible();
    await expect(form.getByRole("button", { name: "About Auto Build", exact: true })).toBeVisible();
    await form.locator('[contenteditable="true"]').first().fill("Evaluate header contributions");
    await expect(form.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
    await form.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(path);
    await main.locator('[data-workbench-panel-header="main"]').click({ button: "right" });
    await page.getByRole("menuitem", { name: "Move to Side", exact: true }).click();
    const side = page.locator('[data-workbench-panel="side"]');
    await page
      .locator('[data-workbench-header-panel="side"]')
      .frameLocator('iframe[title="Timeline actions"]:visible')
      .getByRole("button", { name: "Auto Build", exact: true })
      .click();
    await expect(dialog).toBeVisible();
    await expect(form.getByText("Eligible tickets", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(side.getByRole("tab", { name: "Project Timeline", exact: true })).toBeVisible();
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${id}`);
  }
});
