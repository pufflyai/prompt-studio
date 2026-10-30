import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: a portalled menu must accept input without dismissing its owning dialog.
test("menu selection and keyboard dismissal keep its dialog usable", async ({ page }) => {
  const preview = await openCanvasPreview(page, "ui-components-navigation-searchable-menu--portalled-inside-dialog");
  await preview.getByRole("button", { name: "Select workspace", exact: true }).click();
  const search = preview.getByRole("textbox", { name: "Search workspaces..." });
  await search.fill("origin/main");
  const item = preview.getByRole("menuitem", { name: "main", exact: true });
  await item.click();
  await expect(preview.getByRole("menu")).toBeHidden();
  await expect(preview.getByRole("dialog", { name: "Create workspace" })).toBeVisible();
  const trigger = preview.getByRole("button", { name: "Select workspace", exact: true });
  await trigger.focus();
  await trigger.press("ArrowDown");
  await expect(preview.getByRole("menu")).toBeVisible();
  await preview.getByRole("menu").press("Escape");
  await expect(preview.getByRole("menu")).toBeHidden();
  await expect(preview.getByRole("dialog", { name: "Create workspace" })).toBeVisible();
});

// Critical: saving an edited value must update the visible table.
test("a table cell edit can be saved", async ({ page }) => {
  const preview = await openCanvasPreview(page, "ui-components-data-display-data-table--edit-mode");
  const cell = preview.locator("tbody tr[data-document-row]").first().locator("td[data-column-id='name']");
  await cell.click();
  await preview.getByRole("textbox", { name: "Edit cell", exact: true }).fill("Updated name");
  await preview.getByRole("button", { name: "Save cell", exact: true }).click();
  await expect(cell).toContainText("Updated name");
});

// Critical: menu focus restoration must not steal terminal keyboard input.
test("opening a terminal transfers keyboard focus", async ({ page }) => {
  const preview = await openCanvasPreview(page, "ui-components-terminal--deferred-focus-ignores-popup-restore");
  await preview.getByRole("menuitem", { name: "Open terminal", exact: true }).click();
  await expect(preview.getByRole("textbox", { name: "Terminal input", exact: true })).toBeFocused();
});

// Critical: a broken preview must report its failure instead of remaining in loading state.
test("preview setup failures are visible", async ({ page }) => {
  await page.goto("/?failure=1");
  const shell = page.frameLocator("[data-verification-host]");
  await expect(shell.getByRole("alert")).toContainText("Missing preview source");
});

// Critical: extension examples must load the catalog's fallback provider rather than a missing module.
test("extension examples load their fallback suite provider", async ({ page }) => {
  const preview = await openCanvasPreview(page, "dashboard-motion-lab-study-status--deleted");
  await expect(preview.getByText("This study was deleted or does not exist.", { exact: true })).toBeVisible();
});
