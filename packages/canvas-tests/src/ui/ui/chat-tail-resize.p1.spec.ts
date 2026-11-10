import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical regression: layout-driven scroll clamping must not hide new messages or seize history reading.
test("chat follows a resizing stream and respects deliberate history reading", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/chat-ui/components/chat-panel-resize.canvas.tsx#StreamingResize",
  );
  const viewport = preview.getByRole("log").locator(':scope > [data-scope="scroll-area"] > [data-part="viewport"]');
  const latest = preview.getByRole("button", { name: "Scroll to latest message" });
  await preview.getByText(/^Step 2\./).waitFor();
  const resize = preview.getByRole("button", { name: "Resize panel", exact: true });
  const append = preview.getByRole("button", { name: "Append response" });
  // Emit fixture responses across real animation frames while the retained panel changes size.
  const emitResponses = async (from: number, to: number) => {
    for (let index = from; index <= to; index += 1) {
      await append.evaluate(async (element) => {
        (element as HTMLButtonElement).click();
        await new Promise(requestAnimationFrame);
      });
      await expect(preview.getByRole("status")).toHaveText(`Responses: ${index}`);
    }
  };
  await resize.click();
  await emitResponses(3, 30);
  await expect(preview.getByText(/^Step 30\./)).toBeInViewport();
  await expect(latest).toBeHidden();

  await viewport.hover();
  await page.mouse.wheel(0, -600);
  await expect(latest).toBeVisible();
  const readingTop = await viewport.evaluate((element) => element.scrollTop);
  await append.click();
  await expect(preview.getByRole("status")).toHaveText("Responses: 31");
  await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBe(readingTop);
  await expect(latest).toBeVisible();

  await latest.click();
  await expect(preview.getByText(/^Step 31\./)).toBeInViewport();
  await viewport.press("PageUp");
  await expect(latest).toBeVisible();
  await resize.click();
  await emitResponses(32, 59);
  await expect(latest).toBeVisible();
  await expect(preview.getByText(/^Step 59\./)).not.toBeInViewport();
  await latest.click();
  await expect(preview.getByText(/^Step 59\./)).toBeInViewport();
});
