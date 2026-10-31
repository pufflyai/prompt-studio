import { expect, type Page, test } from "@playwright/test";
import { checkIntrinsicDocumentation } from "../documentation";
import { checkGroupedFolders } from "../folders";
import { checkFrameSelection } from "../selection";

test.use({ viewport: { width: 1440, height: 1000 } });

const openSurface = async (page: Page, id: string) => {
  await page.goto(`/?canvas=${encodeURIComponent(id)}`);
  const element = await page.locator("[data-verification-host]").elementHandle();
  const surface = (await element!.contentFrame())!;
  await expect(surface.locator("[data-canvas-item]").first()).toBeVisible();
  await expect(surface.locator("[data-ui-canvas-loading]")).toHaveCount(0);
  await expect(surface.locator("[data-ui-canvas-error]")).toHaveCount(0);
  return surface;
};

// Critical: unselected previews must not activate; selecting another frame must retain drafts.
test("selection gates input and preserves independent frame state", async ({ page }) => {
  await checkFrameSelection(await openSurface(page, "playground"), page);
});

// Critical: a contained dialog must preserve draft state across themes and stay out of sibling frames.
test("folder dialogs, themes, sibling frames, and camera gestures stay isolated", async ({ page }) => {
  await checkGroupedFolders(
    await openSurface(page, "packages/ui/src/components/overlays/folder-picker-dialog.canvas.tsx"),
    page,
  );
});

// Critical: long documentation must remain readable and retain edited input when it expands.
test("documentation grows without clipping its contents", async ({ page }) => {
  await checkIntrinsicDocumentation(await openSurface(page, "documentation-contract"));
});
