import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Keyboard navigation must reach an unmounted turn and release tail following.
test("jump to an earlier turn, then resize the conversation panel", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/chat-ui/components/chat-panel-width.canvas.tsx#ConversationOutline",
  );
  const rail = preview.getByRole("navigation", { name: "Conversation outline" });
  await expect(preview.getByRole("img", { name: "Message from Alex", exact: true })).toBeVisible();
  const first = rail.getByRole("button", { name: "Check build 1", exact: true });
  await expect(preview.locator('[data-chat-message-id="q-0"]')).toHaveCount(0);
  const last = rail.getByRole("button", { name: "Check build 80", exact: true });
  await expect(last).toHaveAttribute("aria-current", "location");
  await expect(first).toHaveCount(0);
  const earliestRendered = rail.getByRole("button").first();
  const earlierNumber = Number((await earliestRendered.getAttribute("aria-label"))!.match(/\d+$/)![0]) - 1;
  expect(earlierNumber).toBeGreaterThan(0);
  const earlier = rail.getByRole("button", { name: `Check build ${earlierNumber}`, exact: true });
  await expect(earlier).toHaveCount(0);
  await earliestRendered.evaluate((element) => (element as HTMLElement).focus({ preventScroll: true }));
  await page.keyboard.press("Shift+Tab");
  await expect(earlier).toBeFocused();
  await earlier.press("Home");
  await expect(first).toBeFocused();
  await expect(preview.getByRole("tooltip").filter({ hasText: "Build 1 passed." })).toBeVisible();
  await first.press("Enter");
  await expect(preview.locator('[data-chat-message-id="q-0"]')).toBeInViewport();
  const sender = preview.getByRole("img", { name: "Message from Release checks", exact: true });
  await expect(sender).toBeVisible();
  await sender.focus();
  const senderTooltip = preview.getByRole("tooltip", { name: "Release checks", exact: true });
  await expect(senderTooltip).toBeVisible();
  await expect(senderTooltip).toHaveText("Release checks");
  await expect(first).toHaveAttribute("aria-current", "location");
  await first.press("End");
  await expect(last).toBeFocused();
  await last.press("Enter");
  await expect(preview.locator('[data-chat-message-id="a-79"]')).toBeInViewport();
  await expect(last).toHaveAttribute("aria-current", "location");
  await preview.getByRole("button", { name: "Resize conversation" }).click();
  await expect(rail).toBeHidden();
});
