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
  const append = preview.getByRole("button", { name: "Append response", exact: true });
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

// Critical regression: measured row corrections must preserve tail following and keyboard history reading.
test("chat follows batched responses and preserves history through row remeasurement", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/chat-ui/components/chat-panel-resize.canvas.tsx#StreamingResize",
  );
  const viewport = preview.getByRole("log").locator(':scope > [data-scope="scroll-area"] > [data-part="viewport"]');
  const latest = preview.getByRole("button", { name: "Scroll to latest message" });
  await preview.getByText(/^Step 2\./).waitFor();
  const batch = preview.getByRole("button", { name: "Append response batch", exact: true });
  const resize = preview.getByRole("button", { name: "Resize panel", exact: true });
  await batch.click();
  await expect(preview.getByText(/^Step 30\./)).toBeInViewport();
  await expect(latest).toBeHidden();
  await resize.click();
  await expect(preview.getByText(/^Step 30\./)).toBeInViewport();
  await expect(latest).toBeHidden();

  await viewport.press("PageUp");
  await resize.click();
  await batch.click();
  await expect(preview.getByRole("status")).toHaveText("Responses: 58");
  await expect(latest).toBeVisible();
  await expect(preview.getByText(/^Step 58\./)).not.toBeInViewport();
  await latest.click();
  await expect(preview.getByText(/^Step 58\./)).toBeInViewport();
  await expect(latest).toBeHidden();
});

// The public follower can change its lock near the tail without rerendering message-list consumers.
test("chat measures against a live follow lock after stopping and returning near the tail", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/chat-ui/components/chat-panel-resize.canvas.tsx#StreamingResize",
  );
  const latest = preview.getByRole("button", { name: "Scroll to latest message" });
  const batch = preview.getByRole("button", { name: "Append response batch", exact: true });
  const resize = preview.getByRole("button", { name: "Resize panel", exact: true });
  const stop = preview.getByRole("button", { name: "Stop following", exact: true });
  await batch.click();
  await expect(preview.getByText(/^Step 30\./)).toBeInViewport();
  await stop.click();
  await preview.getByRole("button", { name: "Follow latest", exact: true }).click();
  await resize.click();
  await expect(preview.getByText(/^Step 30\./)).toBeInViewport();
  await expect(latest).toBeHidden();

  await stop.click();
  await resize.click();
  await batch.click();
  await expect(preview.getByRole("status")).toHaveText("Responses: 58");
  await expect(latest).toBeVisible();
  await expect(preview.getByText(/^Step 58\./)).not.toBeInViewport();
  await latest.click();
  await expect(preview.getByText(/^Step 58\./)).toBeInViewport();
});

// Retained panels must preserve either the reader's position or the existing tail-following intent.
test("chat restores hidden history and a hidden following tail independently", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/chat-ui/components/chat-panel-resize.canvas.tsx#StreamingResize",
  );
  const viewport = preview.getByRole("log").locator(':scope > [data-scope="scroll-area"] > [data-part="viewport"]');
  const latest = preview.getByRole("button", { name: "Scroll to latest message" });
  const batch = preview.getByRole("button", { name: "Append response batch", exact: true });
  await batch.click();
  await expect(preview.getByText(/^Step 30\./)).toBeInViewport();
  await viewport.press("PageUp");
  await expect(latest).toBeVisible();
  // Page Up and first row measurements can still adjust the reader's offset before Hide.
  const readingTop = await viewport.evaluate(async (element) => {
    let previous = element.scrollTop;
    let stableFrames = 0;
    while (stableFrames < 3) {
      await new Promise(requestAnimationFrame);
      const current = element.scrollTop;
      stableFrames = current === previous ? stableFrames + 1 : 0;
      previous = current;
    }
    return previous;
  });
  await preview.getByRole("button", { name: "Hide conversation" }).click();
  await batch.click();
  await preview.getByRole("button", { name: "Show conversation" }).click();
  await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBe(readingTop);
  await expect(latest).toBeVisible();
  await expect(preview.getByText(/^Step 58\./)).not.toBeInViewport();

  await latest.click();
  await expect(preview.getByText(/^Step 58\./)).toBeInViewport();
  // Returning to latest uses spring motion; begin this arm only once it reaches the actual tail.
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop))
    .toBeLessThanOrEqual(2);
  await preview.getByRole("button", { name: "Hide conversation" }).click();
  await batch.click();
  await preview.getByRole("button", { name: "Show conversation" }).click();
  await expect(preview.getByText(/^Step 86\./)).toBeInViewport();
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop))
    .toBeLessThanOrEqual(2);
  await expect(latest).toBeHidden();
});
