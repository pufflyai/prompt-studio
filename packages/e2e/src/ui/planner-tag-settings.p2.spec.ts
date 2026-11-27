import { expect, type Locator, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { executePlannerCommand } from "../helpers/planner-api";
import { uiOrigin } from "../ui-server";

test("puts new tags first and discards open tag and option drafts on reset", async ({ page, request }) => {
  // Critical risk: a stale inline field can restore discarded text to a later save.
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Tag settings drafts" }),
  });
  expect(created.ok()).toBe(true);
  const { id } = (await created.json()) as { id: string };
  try {
    await page.addInitScript(() => {
      if (window === window.top) localStorage.setItem("onboarding-complete", "true");
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/projects/${id}`);
    await page.getByText("Settings", { exact: true }).last().click();
    const dialog = page.getByRole("dialog").last();
    await dialog.getByRole("option", { name: "Ticket tags", exact: true }).click();
    const panel = page.frameLocator('iframe[title="Ticket tags"]');
    const add = panel.getByRole("button", { name: "Add tag", exact: true });
    const newTag = panel.getByRole("button", { name: "Delete New tag", exact: true });
    const order = panel.getByRole("button", { name: /^(Add tag|Delete (New tag|Priority))$/ });
    const reset = dialog.getByRole("button", { name: "Reset", exact: true });
    const input = panel.getByRole("textbox");
    const discardDraft = async (name: Locator) => {
      await name.click();
      await input.fill("Discard this rename");
      await reset.click();
      await expect(newTag).toHaveCount(0);
      await expect(input).toHaveCount(0);
      await expect(name).toBeVisible();
      await expect(reset).toHaveCount(0);
    };

    await expect(order.first()).toHaveAccessibleName("Add tag");
    await add.click();
    await expect(order.nth(1)).toHaveAccessibleName("Delete New tag");
    await discardDraft(panel.getByText("Priority", { exact: true }));

    await add.click();
    await discardDraft(panel.getByText("Low", { exact: true }));

    await add.click();
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(reset).toHaveCount(0);
    const { tags } = await executePlannerCommand<{ tags: { name: string }[] }>(
      request,
      uiOrigin,
      id,
      "ticket-tag.read",
      {},
    );
    expect(tags.map((tag) => tag.name)).toEqual(["New tag", "Priority", "Type", "Complexity"]);
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${id}`);
  }
});
