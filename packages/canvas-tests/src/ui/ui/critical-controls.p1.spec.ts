import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: highlighted menu labels and checkmarks must stay readable during keyboard selection.
test("imported menu highlights keep their matching text and indicator colors", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/overlays/menu-selection.canvas.tsx#PaleSelection",
  );
  await preview.getByRole("button", { name: "Layout options", exact: true }).click();
  const menu = preview.getByRole("menu").first();
  const pinned = preview.getByRole("menuitemcheckbox", { name: "Pinned", exact: true });
  await expect(menu).toHaveCSS("background-color", "rgb(36, 36, 36)");
  await pinned.hover();
  await expect(pinned).toHaveCSS("background-color", "rgb(238, 238, 238)");
  await expect(pinned).toHaveCSS("color", "rgb(17, 17, 17)");
  await expect(pinned.locator("[data-part=item-indicator]")).toHaveCSS("color", "rgb(17, 17, 17)");
  await menu.press("End");
  await menu.press("Home");
  await expect(pinned).toHaveAttribute("data-highlighted", "");
  await expect(pinned).toHaveCSS("background-color", "rgb(238, 238, 238)");
  await expect(pinned).toHaveCSS("color", "rgb(17, 17, 17)");
});

// Critical: a portalled menu must accept input without dismissing its owning dialog.
test("menu selection and keyboard dismissal keep its dialog usable", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/overlays/searchable-menu.canvas.tsx#PortalledInsideDialog",
  );
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
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/data-table/data-table.canvas.tsx#Default",
    "Edit mode",
  );
  const cell = preview.locator("tbody tr[data-document-row]").first().locator("td[data-column-id='name']");
  await cell.click();
  await preview.getByRole("textbox", { name: "Edit cell", exact: true }).fill("Updated name");
  await preview.getByRole("button", { name: "Save cell", exact: true }).click();
  await expect(cell).toContainText("Updated name");
});

// Critical: menu focus restoration must not steal terminal keyboard input.
test("opening a terminal transfers keyboard focus", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/terminal/terminal.canvas.tsx#DeferredFocusIgnoresPopupRestore",
  );
  await preview.getByRole("menuitem", { name: "Open terminal", exact: true }).click();
  await expect(preview.getByRole("textbox", { name: "Terminal input", exact: true })).toBeFocused();
});

// Critical: a broken preview must report its failure instead of remaining in loading state.
test("preview setup failures are visible", async ({ page }) => {
  await page.goto("/?failure=1");
  const shell = page.frameLocator("[data-verification-host]");
  await expect(shell.getByRole("alert")).toContainText("Missing preview source");
});

// Critical: migrated studies must load their project's Chakra provider and shared scene kit.
test("motion studies load their project provider", async ({ page }) => {
  const preview = await openCanvasPreview(page, "design/motion/studies/tabs/study.canvas.tsx#Subtle");
  await expect(preview.getByLabel("README.md", { exact: true })).toBeVisible();
});

// Critical: a clipped selected value must remain readable without breaking dropdown activation.
test("clipped dropdown captions reveal their full value and keep the menu usable", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/overlays/menu-selection.canvas.tsx#CheckmarksAndAlignment",
  );
  const trigger = preview.getByRole("button", { name: "Layout options", exact: true });
  await trigger.hover();
  await expect(preview.getByRole("tooltip")).toHaveCount(0);
  await preview.getByRole("button", { name: "Toggle long dropdown label", exact: true }).click();
  const caption = "Layout options — a long selected value whose full text remains available in a tooltip";
  const clipped = preview.getByRole("button", { name: caption, exact: true });
  await clipped.hover();
  await expect(preview.getByRole("tooltip")).toHaveText(caption);
  await clipped.click();
  await expect(preview.getByRole("tooltip")).toBeHidden();
  await expect(preview.getByRole("menu").first()).toBeVisible();
  await preview.getByRole("menu").first().press("Escape");
  await expect(clipped).toBeFocused();
  await expect(preview.getByRole("tooltip")).toHaveText(caption);
  await preview.getByRole("button", { name: "Toggle long dropdown label", exact: true }).click();
  await trigger.hover();
  await expect(preview.getByRole("tooltip")).toBeHidden();
  await preview.getByRole("button", { name: "Toggle explicit dropdown tooltip", exact: true }).click();
  await preview.getByRole("button", { name: "Toggle long dropdown label", exact: true }).click();
  await clipped.hover();
  await expect(preview.getByRole("tooltip")).toHaveText("Explicit dropdown explanation");
  await expect(clipped).toHaveAttribute("aria-haspopup", "menu");
  await clipped.click();
  await expect(preview.getByRole("tooltip")).toBeHidden();
  await expect(preview.getByRole("menu").first()).toBeVisible();
  await preview.getByRole("menu").first().press("Escape");
  await expect(clipped).toBeFocused();
});

test("native resource choices announce their selection and restore focus on keyboard dismissal", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/overlays/menu-selection.canvas.tsx#CheckmarksAndAlignment",
  );
  const trigger = preview.getByRole("button", { name: "Resource options", exact: true });
  await trigger.click();
  await expect(preview.getByRole("menuitemradio", { name: "First saved version", exact: true })).toBeChecked();
  await preview.getByRole("menuitemradio", { name: "Second saved version", exact: true }).click();
  await expect(preview.getByRole("menu")).toBeHidden();
  await trigger.click();
  await expect(preview.getByRole("menuitemradio", { name: "Second saved version", exact: true })).toBeChecked();
  await expect(preview.getByRole("menuitemradio", { name: "First saved version", exact: true })).not.toBeChecked();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

// Critical: keyboard users must see the highlighted row inside a bounded menu's ScrollArea.
test("keyboard navigation keeps menu choices in their nested scroll viewport", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/overlays/menu-selection.canvas.tsx#CheckmarksAndAlignment",
  );
  const trigger = preview.getByRole("button", { name: "Saved versions", exact: true });
  await trigger.press("ArrowDown");
  const menu = preview.getByRole("menu");
  await menu.press("End");
  const last = preview.getByRole("menuitemradio", { name: "Saved revision 60", exact: true });
  await expect(last).toHaveAttribute("data-highlighted", "");
  await expect
    .poll(() =>
      last.evaluate((row) => {
        const viewport = row.closest('[data-scope="scroll-area"][data-part="viewport"]')!;
        const bounds = viewport.getBoundingClientRect();
        const item = row.getBoundingClientRect();
        return item.top >= bounds.top && item.bottom <= bounds.bottom;
      }),
    )
    .toBe(true);
  await menu.press("Enter");
  await expect(trigger).toBeFocused();
  await trigger.press("ArrowDown");
  await expect(last).toBeChecked();
  await menu.press("Home");
  const first = preview.getByRole("menuitemradio", { name: "Saved revision 1", exact: true });
  await expect
    .poll(() =>
      first.evaluate((row) => {
        const viewport = row.closest('[data-scope="scroll-area"][data-part="viewport"]')!;
        return row.getBoundingClientRect().top >= viewport.getBoundingClientRect().top;
      }),
    )
    .toBe(true);
});
