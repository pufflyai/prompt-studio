import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: switching projects must not leak the preceding project's mutable view state.
test("switching projects starts project views fresh", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "workbench-pstdio-workbench-guides-project-switch--keeps-shell-mounted",
  );
  await expect(preview.getByText("Project A content", { exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Notes edited 0 times" }).click();
  await expect(preview.getByRole("button", { name: "Notes edited 1 times" })).toBeVisible();
  await preview.getByRole("button", { name: "Open Project B" }).click();
  await expect(preview.getByText("Project B content", { exact: true })).toBeVisible();
  await expect(preview.getByRole("button", { name: "Notes edited 0 times" })).toBeVisible();
  await expect(preview.getByRole("button", { name: "Notes edited 1 times" })).toHaveCount(0);
});

// Critical: replacing an unpinned preview must preserve pinned resource tabs and their drafts.
test("resource previews share a tray and retain pinned tabs", async ({ page }) => {
  const preview = await openCanvasPreview(page, "workbench-pstdio-workbench-guides-panels-and-pages--resource-tabs");
  const header = preview.locator('[data-workbench-panel-header="secondary"]');
  await preview.getByRole("button", { name: "Preview Alpha" }).click();
  await expect(header.getByRole("tab", { name: "Alpha.md" })).toBeVisible();
  await preview.getByRole("button", { name: "Preview Beta" }).click();
  await expect(header.getByRole("tab", { name: "Alpha.md" })).toHaveCount(0);
  const beta = header.getByRole("tab", { name: "Beta.md" });
  await expect(beta).toBeVisible();
  await beta.click({ button: "right" });
  await preview.getByRole("menuitem", { name: "Pin tab", exact: true }).click();
  await preview.getByRole("button", { name: "Preview Alpha" }).click();
  await expect(header.getByRole("tab")).toHaveCount(2);
  await preview.getByRole("button", { name: "Preview Beta" }).click();
  await expect(header.getByRole("tab")).toHaveCount(2);
  await expect(beta).toHaveAttribute("aria-selected", "true");
});

// Critical: moving a live panel must preserve its unsaved input.
test("moving a panel preserves its draft", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "workbench-pstdio-workbench-reference-core-api-panel-arrangement--closed-bottom",
  );
  const source = preview.locator('[data-workbench-panel="side"]:visible');
  const tab = source.getByRole("tab", { selected: true });
  await source.getByRole("textbox", { name: "Retained draft" }).fill("Keep this draft");
  const box = (await tab.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 12, box.y + box.height / 2, { steps: 3 });
  await preview.locator('[data-workbench-edge-hit="secondary"][data-workbench-edge-position="bottom"]').hover();
  await page.mouse.up();
  await expect(
    preview.locator('[data-workbench-panel="secondary"]:visible').getByRole("textbox", { name: "Retained draft" }),
  ).toHaveValue("Keep this draft");
});

// Critical: tab navigation must restore keyboard focus without losing the preceding draft.
test("keyboard tab navigation restores focus and draft state", async ({ page }) => {
  const preview = await openCanvasPreview(page, "workbench-pstdio-workbench-reference-keyboard--visible-panels");
  await preview.getByRole("tab", { name: "PS-1", exact: true }).click();
  await preview.getByRole("textbox", { name: "Draft 1", exact: true }).fill("Retained keyboard draft");
  await page.keyboard.press("Control+Tab");
  await expect(preview.getByRole("textbox", { name: "Draft 2", exact: true })).toBeFocused();
  await page.keyboard.press("Control+Shift+Tab");
  const draft = preview.getByRole("textbox", { name: "Draft 1", exact: true });
  await expect(draft).toBeFocused();
  await expect(draft).toHaveValue("Retained keyboard draft");
});
