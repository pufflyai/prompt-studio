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
    await page.goto(timelinePath);
    const timeline = page.frameLocator('iframe[title="Project Timeline"]');
    await expect(timeline.getByRole("button", { name: "Auto Build", exact: true })).toBeVisible();
    await page.getByRole("option", { name: "Tickets", exact: true }).click();
    await page.getByRole("button", { name: "Create row", exact: true }).first().click();
    const form = page.getByRole("dialog").last();
    await form.locator('[contenteditable="true"]').first().fill("Created before returning to the timeline");
    await form.getByRole("button", { name: "Create ticket", exact: true }).click();
    await expect(form).toBeHidden();
    await page.getByRole("button", { name: "Back to project", exact: true }).click();
    await page.getByRole("option", { name: "Project Timeline", exact: true }).click();
    await expect(timeline.getByText("Created before returning to the timeline", { exact: true })).toBeVisible();
    await expect(page.getByText("The calling viewer is no longer open", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => Reflect.get(window, "timelineViewerErrors"))).toEqual([]);
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${id}`);
  }
});
