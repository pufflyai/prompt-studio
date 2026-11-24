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
  const last = rail.getByRole("button", { name: "Check build 24", exact: true });
  await expect(last).toHaveAttribute("aria-current", "location");
  await first.focus();
  await expect(preview.getByRole("tooltip")).toContainText("Build 1 passed.");
  await first.press("Enter");
  await expect(preview.locator('[data-chat-message-id="q-0"]')).toBeInViewport();
  const sender = preview.getByRole("img", { name: "Message from Release checks", exact: true });
  await expect(sender).toBeVisible();
  await sender.focus();
  const senderTooltip = preview.getByRole("tooltip", { name: "Release checks", exact: true });
  await expect(senderTooltip).toBeVisible();
  await expect(senderTooltip).toHaveText("Release checks");
  await expect(first).toHaveAttribute("aria-current", "location");
  await last.click();
  await expect(preview.locator('[data-chat-message-id="a-23"]')).toBeInViewport();
  await expect(last).toHaveAttribute("aria-current", "location");
  await preview.getByRole("button", { name: "Resize conversation" }).click();
  await expect(rail).toBeHidden();
});
