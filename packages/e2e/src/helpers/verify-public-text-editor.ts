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
