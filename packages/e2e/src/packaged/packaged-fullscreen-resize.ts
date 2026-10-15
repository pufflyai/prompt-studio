import { expect, type Page } from "@playwright/test";

export const verifyPackagedFullscreenResizeCancellation = async (page: Page) => {
  const panels = page.getByRole("button", { name: / panels$/ });
  await panels.click();
  const bottom = page.getByRole("menuitemcheckbox", { name: "Bottom panel", exact: true });
  const wasOpen = (await bottom.getAttribute("aria-checked")) === "true";
  if (wasOpen) await page.keyboard.press("Escape");
  else await bottom.click();
  await page.getByRole("button", { name: "Expand page", exact: true }).click();
  const handle = page.getByRole("separator", { name: "Resize page bottom", exact: true });
  await expect(handle).toBeVisible();
  const size = () =>
    handle.evaluate(
      (element) =>
        document.getElementById(element.getAttribute("aria-controls")!.split(" ")[0]!)!.getBoundingClientRect().height,
    );
  await expect.poll(() => handle.evaluate((element) => element.parentElement!.getAnimations().length)).toBe(0);
  const previousSize = await size();
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 600, { steps: 8 });
  await expect(handle).toHaveAttribute("data-closing", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Exit fullscreen", exact: true })).toBeVisible();
  await expect(handle).toHaveAttribute("data-closing", "false");
  await expect.poll(async () => Math.abs((await size()) - previousSize)).toBeLessThan(1);
  await page.mouse.up();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Expand page", exact: true })).toBeFocused();
  if (!wasOpen) {
    await panels.click();
    await bottom.click();
  }
};
