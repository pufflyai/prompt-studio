import type { Page } from "../scripts/playwright-test";
import { expect } from "../scripts/playwright-test";

/** A missing bridge adapter or ignored cross-publisher selection blocks the primary editing task. */
export const verifyPublicTextEditor = async (page: Page, selected: boolean, initial: string) => {
  const frame = page.frameLocator('iframe[title="Installed text editor"]');
  const editor = frame.getByRole("textbox", { name: "Installed editor source" });
  await expect(editor).toHaveValue(initial);
  await expect(frame.locator('[data-public-yjs="compatible"]')).toHaveCount(1);
  await expect(frame.locator(`[data-selected-source="${selected}"]`)).toHaveCount(1);
  await expect(frame.locator("[data-unselected-source]")).toHaveAttribute(
    "data-unselected-source",
    "source_unavailable",
  );
  return editor;
};

/** The document body in Main; resource activity keeps its own comment composer outside it. */
export const nativePublicTextEditor = (page: Page) =>
  page
    .getByRole("region", { name: "Main", exact: true })
    .getByRole("textbox", { name: "", exact: true })
    .and(page.locator(':not([aria-label="Resource activity"] *)'));

/** The default Markdown renderer must edit the same declared public source as its installed peer. */
export const verifyNativePublicTextEditor = async (page: Page, initial: string) => {
  const editor = nativePublicTextEditor(page);
  await expect(editor).toHaveCount(1);
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await expect(editor).toHaveText(initial);
  return editor;
};
