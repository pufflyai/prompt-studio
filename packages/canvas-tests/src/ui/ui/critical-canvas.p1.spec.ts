import { expect, type Page, test } from "@playwright/test";
import { checkIntrinsicDocumentation, profilePopulatedCanvas } from "../documentation";
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

// Critical: a contained dialog must preserve draft state across themes and reset on variant changes.
test("folder dialogs, themes, variants, and camera gestures stay isolated", async ({ page }) => {
  await checkGroupedFolders(await openSurface(page, "stories-ui-overlays-folderpickerdialog"), page);
});

// Critical: long documentation must remain readable and retain edited input when it expands.
test("documentation grows without clipping its contents", async ({ page }) => {
  await checkIntrinsicDocumentation(await openSurface(page, "documentation-contract"));
});

// Critical: preserve the fixed workload used to detect camera regressions.
test("the populated camera workload retains 24 previews and batches saves", async ({ page }, info) => {
  const surface = await openSurface(page, "verification-populated");
  await expect(surface.locator('iframe[data-frame-ready="true"]')).toHaveCount(24);
  const result = await profilePopulatedCanvas(surface);
  expect(result.previews).toBe(24);
  expect(result.saves).toBe(1);
  await info.attach("camera-workload", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
});

// Critical: startup must stay responsive, and offscreen frames must not deadlock the queue waiting for paint.
test("bounded startup reaches all 24 frames and reuses their immutable assets", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/preview-assets" && request.method() === "POST")
      requested.push(request.postDataJSON().source);
  });
  const surface = await openSurface(page, "verification-populated");
  await expect(surface.locator('iframe[data-frame-ready="true"]')).toHaveCount(24);
  const maximum = Number(await surface.locator("html").getAttribute("data-canvas-startup-maximum"));
  expect(maximum).toBeGreaterThan(0);
  expect(maximum).toBeLessThanOrEqual(4);
  expect(requested).toEqual(["$runtime", "$native:interactive-previews.tsx"]);
});
