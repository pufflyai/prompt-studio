import { expect, type Page, test } from "@playwright/test";
import { checkIntrinsicDocumentation, profilePopulatedCanvas } from "../documentation";
import { checkGroupedFolders } from "../folders";
import { checkFrameSelection } from "../selection";

test.use({ viewport: { width: 1440, height: 1000 } });

const openSurface = async (page: Page, id: string, readinessTimeout?: number) => {
  await page.goto(`/?canvas=${encodeURIComponent(id)}`);
  const element = await page.locator("[data-verification-host]").elementHandle();
  const surface = (await element!.contentFrame())!;
  await expect(surface.locator("[data-canvas-item]").first()).toBeVisible();
  await expect(surface.locator("[data-ui-canvas-loading]")).toHaveCount(0, { timeout: readinessTimeout });
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
  await page.addInitScript(() => {
    const events: { type: string; at: number }[] = [];
    Object.defineProperty(window, "__canvasStartup", { value: events });
    window.addEventListener("message", ({ data }) => {
      if (
        data?.protocol === "pstdio.canvas.preview" &&
        ["bootstrap", "boot", "render", "loaded", "error"].includes(data.type)
      )
        events.push({ type: data.type, at: performance.timeOrigin + performance.now() });
    });
  });
  try {
    const surface = await openSurface(page, "verification-populated", 8_000);
    await expect(surface.locator('iframe[data-frame-ready="true"]')).toHaveCount(24);
    const result = await profilePopulatedCanvas(surface);
    expect(result.previews).toBe(24);
    expect(result.saves).toBe(1);
    await info.attach("camera-workload", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
  } finally {
    const startup = await Promise.all(
      page.frames().map(async (frame) => ({
        url: frame.url(),
        events: await frame.evaluate(() => Reflect.get(window, "__canvasStartup")).catch(() => undefined),
      })),
    );
    await info.attach("frame-startup", { body: JSON.stringify(startup, null, 2), contentType: "application/json" });
  }
});
