import { expect, type FrameLocator, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

const canvas = "packages/pstdio-workbench/src/react/workbench/multiple-workbenches.canvas.tsx";
// Host activation can arrive while a modal owns pointer input.
const select = (preview: FrameLocator, name: string) =>
  preview
    .getByRole("button", { name: `Select ${name}`, exact: true })
    .evaluate((element: HTMLButtonElement) => element.click());

// Critical: retained keyboard mode must preserve its search and release completed focus requests.
test("switching retains keyboard search without replaying a completed focus request", async ({ page }) => {
  const preview = await openCanvasPreview(page, `${canvas}#RetainedProjects`);
  const draft = preview.getByRole("textbox", { name: "A draft", exact: true });
  await draft.fill("Unsaved A");
  await page.keyboard.press("Alt+Shift+Space");
  await page.keyboard.press("/");
  const search = preview.getByRole("textbox", { name: "Search keyboard choices" });
  await search.fill("Increment");
  await select(preview, "B");
  await preview.getByRole("textbox", { name: "B draft", exact: true }).fill("Unsaved B");
  await select(preview, "A");
  await expect(search).toHaveValue("Increment");
  await expect(search).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(draft).toBeFocused();
  await preview.getByRole("button", { name: "Select A", exact: true }).focus();
  await select(preview, "B");
  await select(preview, "A");
  await expect(preview.getByRole("button", { name: "Select A", exact: true })).toBeFocused();
  await expect(draft).toHaveValue("Unsaved A");
});

// Critical: a hidden picker must release dismissable-layer listeners and retain its draft/open state.
test("switching suspends a color picker and restores its open state", async ({ page }) => {
  const preview = await openCanvasPreview(page, `${canvas}#RetainedProjects`);
  const picker = preview.locator('[data-scope="color-picker"][data-part="root"]').first();
  await picker.locator('[data-part="trigger"]').click();
  await expect(picker.locator('[data-part="content"]')).toBeVisible();
  await select(preview, "B");
  await preview.getByRole("textbox", { name: "B draft", exact: true }).fill("B stays editable");
  await expect(picker.locator('[data-part="content"]')).toBeHidden();
  await select(preview, "A");
  await expect(picker.locator('[data-part="content"]')).toBeVisible();
});

// Critical: the enclosing theme provider remains the owner across activation and inner remounts.
test("outer theme controls remain connected to remounted workbenches", async ({ page }) => {
  const preview = await openCanvasPreview(page, `${canvas}#InheritedTheme`);
  const theme = preview.getByRole("button", { name: /^Outer theme:/ });
  const before = await theme.textContent();
  await theme.click();
  const chosen = (await theme.textContent())!.replace("Outer theme: ", "");
  expect(await theme.textContent()).not.toBe(before);
  await expect(preview.locator("[data-ui-scope]:visible")).toHaveAttribute("data-theme", chosen);
  await select(preview, "B");
  await expect(preview.locator("[data-ui-scope]:visible")).toHaveAttribute("data-theme", chosen);
  await preview.getByRole("button", { name: "Remount workbenches" }).click();
  await expect(preview.getByRole("textbox", { name: "A draft", exact: true })).toBeVisible();
  await expect(preview.locator("[data-ui-scope]:visible")).toHaveAttribute("data-theme", chosen);
  await expect(theme).toHaveText(`Outer theme: ${chosen}`);
});

// Critical: events in another project must not discard an unfinished link edit or its selection.
test("an unfinished rich text link survives background resize and another editor's updates", async ({ page }) => {
  const preview = await openCanvasPreview(page, `${canvas}#RichTextEditors`);
  const editor = preview.getByRole("group", { name: "A rich text" }).locator('[contenteditable="true"]');
  await editor.fill("Example");
  await editor.press("ControlOrMeta+A");
  await preview.getByRole("button", { name: "Insert Link", exact: true }).click();
  const url = preview.getByRole("textbox", { name: "Link URL", exact: true });
  await url.fill("https://example.com/draft");
  await select(preview, "B");
  await preview.locator("body").evaluate(() => window.dispatchEvent(new Event("resize")));
  await preview.getByRole("group", { name: "B rich text" }).locator('[contenteditable="true"]').fill("Other project");
  await select(preview, "A");
  await expect(url).toHaveValue("https://example.com/draft");
  await preview.getByRole("button", { name: "Confirm link edit", exact: true }).click();
  await expect(editor.getByRole("link", { name: "Example" })).toHaveAttribute("href", "https://example.com/draft");
});
