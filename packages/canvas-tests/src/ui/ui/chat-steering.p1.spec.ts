import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

test("keeps the preceding tool call visible when a queued message is sent mid-turn", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/chat-ui/components/queued-conversation.canvas.tsx#InlineEditor",
  );
  const transcript = preview.getByRole("log");
  const command = transcript.getByText("git status", { exact: true });
  await expect(command).toBeVisible();

  const handle = preview.getByRole("button", { name: "Drag queued follow-up 1", exact: true });
  const source = await handle.boundingBox();
  expect(source).not.toBeNull();
  const x = source!.x + source!.width / 2;
  const y = source!.y + source!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 10);
  const sendNow = preview.locator("[data-queue-send-now]");
  await expect(sendNow).toBeVisible();
  const target = await sendNow.boundingBox();
  expect(target).not.toBeNull();
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, { steps: 8 });
  await expect(sendNow).toHaveAttribute("data-targeted", "true");
  await page.mouse.up();

  await expect(transcript.getByText("Queued message 1", { exact: true })).toBeVisible();
  await expect(command).toBeVisible();
});
