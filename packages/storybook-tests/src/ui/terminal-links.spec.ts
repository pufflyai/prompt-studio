import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "./storybook";

const storyId = "components-terminal--web-links";
let baseUrl = "";
let storybook: ChildProcessWithoutNullStreams | undefined;

test.beforeAll(async () => {
  ({ baseUrl, storybook } = await startStorybook(storyId));
});
test.afterAll(async () => {
  await stopStorybook(storybook);
});

test("modifier-clicking terminal links opens their target URL", async ({ page }) => {
  test.slow();
  // Record opened URLs instead of opening external pages.
  await page.addInitScript(() => {
    const opened: string[] = [];
    Object.assign(window, { __openedUrls: opened });
    window.open = (url?: string | URL) => {
      opened.push(String(url ?? ""));
      return null;
    };
  });
  await page.goto(storyUrl(baseUrl, storyId));
  await waitForStoryPlayback(page);

  const links = [
    { label: "https://example.com/terminal?from=preview", url: "https://example.com/terminal?from=preview" },
    { label: "Open the terminal guide", url: "https://example.com/guide" },
  ];
  for (const link of links) {
    await page.evaluate(() => (window as unknown as { __openedUrls: string[] }).__openedUrls.splice(0));
    const row = page.locator(".xterm-rows > div").filter({ hasText: link.label });
    const box = (await row.boundingBox())!;
    await page.mouse.move(box.x + 30, box.y + box.height / 2);
    await expect(page.locator(".xterm-screen")).toHaveClass(/xterm-cursor-pointer/);
    await page.keyboard.down("ControlOrMeta");
    await page.mouse.click(box.x + 30, box.y + box.height / 2);
    await page.keyboard.up("ControlOrMeta");
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __openedUrls: string[] }).__openedUrls))
      .toEqual([link.url]);
  }
});
