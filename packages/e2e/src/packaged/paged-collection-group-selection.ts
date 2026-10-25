import { expect, type Page } from "@playwright/test";

export const exerciseGroupedPageSelection = async (page: Page) => {
  const clear = page.getByRole("button", { name: "clear-selection", exact: true });
  if (await clear.isVisible()) await clear.click();
  const nextPage = (offset: number) =>
    page.waitForResponse((response) => {
      if (!response.url().includes("example.paged-owner-0.view.table.") || !response.url().endsWith(".query/execute"))
        return false;
      const input = response.request().postDataJSON()?.params;
      return input?.settings?.grouping === "status" && input.page.offset === offset;
    });
  await page.getByRole("button", { name: "Display settings", exact: true }).click();
  await page.getByRole("button", { name: "Grouping None", exact: true }).click();
  const firstPage = nextPage(0);
  await page.getByRole("menuitem", { name: "Status", exact: true }).click();
  await page.keyboard.press("Escape");
  const first = (await (await firstPage).json()).outcome.value.rows[0];
  await expect(page.getByRole("cell", { name: first.values.title, exact: true })).toBeVisible();
  await page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: first.values.title, exact: true }) })
    .getByLabel("Select row", { exact: true })
    .click();
  const continuation = nextPage(100);
  await page.getByRole("button", { name: "Go to next page", exact: true }).click();
  const second = (await (await continuation).json()).outcome.value.rows[0];
  await expect(page.getByRole("cell", { name: second.values.title, exact: true })).toBeVisible();
  await page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: second.values.title, exact: true }) })
    .getByLabel("Select row", { exact: true })
    .click();
  const selected = page.waitForResponse((response) =>
    response.url().endsWith("example.paged-owner-0.command.selection/execute"),
  );
  await page.getByRole("button", { name: "Use selected rows", exact: true }).click();
  expect(new Set((await (await selected).json()).outcome.value)).toEqual(new Set([first.id, second.id]));
  const done = page.getByTestId("data-table-group-row").getByRole("button", { name: "done 125", exact: true });
  await done.click();
  await expect(done).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("cell", { name: "paged-owner-0 row 0000", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: /^paged-owner-0 row / })).toHaveCount(100);
  await expect(page.getByRole("spinbutton")).toHaveValue("1");
  const todo = page.getByTestId("data-table-group-row").getByRole("button", { name: "todo 125", exact: true });
  const collapsed = nextPage(0);
  await todo.click();
  expect((await (await collapsed).json()).outcome.value.rows).toEqual([]);
  await expect(todo).toHaveAttribute("aria-expanded", "false");
  await expect(done).toHaveAttribute("aria-expanded", "false");
  await expect(done).toBeVisible();
  await done.click();
  await expect(done).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("cell", { name: "paged-owner-0 row 0001", exact: true })).toBeVisible();
};
