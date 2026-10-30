declare global {
  interface Window {
    __CANVAS_VERIFICATION__: { saves: number; longTasks: number[] };
  }
}

import type { Frame } from "@playwright/test";

export const checkIntrinsicDocumentation = async (page: Frame) => {
  await page.getByRole("button", { name: "Select Long documentation · intrinsic height", exact: true }).click();
  const panel = page.locator('[data-canvas-preview="long-documentation"]');
  const content = panel.frameLocator("iframe");
  const initialHeight = await panel.evaluate((element) => element.clientHeight);
  await content
    .getByRole("textbox", { name: "Documentation draft" })
    .fill("Retained during expansion and theme changes");
  await content.getByRole("button", { name: "Expand API reference" }).click();
  await page.waitForFunction((initial) => {
    const panel = document.querySelector<HTMLElement>('[data-canvas-preview="long-documentation"]');
    return panel && panel.clientHeight > initial;
  }, initialHeight);
  await page.getByRole("button", { name: "Switch verification theme" }).click();
  if (
    (await content.getByRole("textbox", { name: "Documentation draft" }).inputValue()) !==
    "Retained during expansion and theme changes"
  ) {
    throw new Error("Theme change remounted the documentation input");
  }
  await page.getByRole("region", { name: "Documentation panels canvas" }).press("f");
  await page.waitForFunction(() => {
    const item = document.querySelector('[data-canvas-item="long-documentation"]')?.getBoundingClientRect();
    const viewport = document.querySelector("[data-canvas-viewport]")?.getBoundingClientRect();
    return item && viewport && item.top >= viewport.top && item.bottom <= viewport.bottom;
  });
  const measurement = await panel.evaluate((element) => {
    return {
      height: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflow: getComputedStyle(element).overflowY,
      innerScrollAreas: element.querySelectorAll('[data-scope="scroll-area"]').length,
    };
  });
  const bottomVisible = await content
    .locator("[data-documentation-end]")
    .evaluate((end) => end.getBoundingClientRect().bottom <= window.innerHeight + 1);
  if (
    measurement.scrollHeight > measurement.height + 1 ||
    !bottomVisible ||
    measurement.innerScrollAreas ||
    ["auto", "scroll", "hidden", "clip"].includes(measurement.overflow)
  ) {
    throw new Error(`Documentation is clipped or scrolls vertically: ${JSON.stringify(measurement)}`);
  }
  return { initialHeight, ...measurement, bottomVisible };
};

export const profilePopulatedCanvas = async (page: Frame) => {
  const viewport = page.getByRole("region", { name: "Populated verification canvas" });
  await Promise.all(page.childFrames().map((frame) => frame.evaluate(() => document.fonts.ready)));
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const startupLongTasks = await page.evaluate(() => {
    const tasks = window.__CANVAS_VERIFICATION__.longTasks;
    window.__CANVAS_VERIFICATION__.longTasks = [];
    window.__CANVAS_VERIFICATION__.saves = 0;
    return tasks;
  });
  const start = performance.now();
  for (let index = 0; index < 24; index++) await viewport.press(index % 2 ? "ArrowLeft" : "ArrowRight");
  for (let index = 0; index < 8; index++) await viewport.press(index % 2 ? "-" : "+");
  await page.waitForFunction(() => window.__CANVAS_VERIFICATION__.saves > 0);
  return {
    previews: await page.locator("[data-canvas-item]").count(),
    navigationMs: performance.now() - start,
    startupLongTasks,
    ...(await page.evaluate(() => window.__CANVAS_VERIFICATION__)),
  };
};
