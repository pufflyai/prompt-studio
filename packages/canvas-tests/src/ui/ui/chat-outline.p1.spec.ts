import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Keyboard navigation must reach an unmounted turn and release tail following.
test("jump to an earlier turn, then resize the conversation panel", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/chat-ui/components/chat-panel-width.canvas.tsx#ConversationOutline",
  );
  const rail = preview.getByRole("navigation", { name: "Conversation outline" });
  const tray = preview.locator("[data-chat-message-action-panel]");
  await expect(tray.getByRole("img", { name: "Message from Alex", exact: true })).toBeVisible();
  const first = rail.getByRole("button", { name: "Check build 1", exact: true });
  await expect(preview.locator('[data-chat-message-id="q-0"]')).toHaveCount(0);
  const last = rail.getByRole("button", { name: "Check build 240", exact: true });
  await expect(last).toHaveAttribute("aria-current", "location");
  await last.focus();
  const earliestRendered = Number(
    (await rail.getByRole("button").first().getAttribute("aria-label"))!.split(" ").at(-1),
  );
  const previous = rail.getByRole("button", { name: `Check build ${earliestRendered - 1}`, exact: true });
  await expect(previous).toHaveCount(0);
  for (let turn = 240; turn >= earliestRendered; turn--) await preview.locator(":focus").press("Shift+Tab");
  await expect(previous).toBeFocused();
  await previous.press("Home");
  await expect(first).toBeFocused();
  const latestRendered = Number((await rail.getByRole("button").last().getAttribute("aria-label"))!.split(" ").at(-1));
  const next = rail.getByRole("button", { name: `Check build ${latestRendered + 1}`, exact: true });
  await expect(next).toHaveCount(0);
  for (let turn = 1; turn <= latestRendered; turn++) await preview.locator(":focus").press("Tab");
  await expect(next).toBeFocused();
  await next.press("Home");
  await expect(first).toBeFocused();
  await expect(preview.getByRole("tooltip", { name: "Check build 1 Build 1 passed.", exact: true })).toBeVisible();
  await first.press("Enter");
  await expect(preview.locator('[data-chat-message-id="q-0"]')).toBeInViewport();
  const sender = tray.getByRole("button", { name: "Open session Release checks", exact: true });
  await expect(sender).toBeVisible();
  await sender.focus();
  const senderTooltip = preview.getByRole("tooltip", { name: "Release checks", exact: true });
  await expect(senderTooltip).toBeVisible();
  await expect(senderTooltip).toHaveText("Release checks");
  await sender.press("Enter");
  await expect(preview.getByLabel("Opened session")).toHaveText("release-checks");
  await expect(first).toHaveAttribute("aria-current", "location");
  await first.press("End");
  await expect(last).toBeFocused();
  await last.press("ArrowUp");
  const penultimate = rail.getByRole("button", { name: "Check build 239", exact: true });
  await expect(penultimate).toBeFocused();
  await penultimate.press("ArrowDown");
  await expect(last).toBeFocused();
  await last.press("Enter");
  await expect(preview.locator('[data-chat-message-id="a-239"]')).toBeInViewport();
  await expect(last).toHaveAttribute("aria-current", "location");
  await preview.getByRole("button", { name: "Resize conversation" }).click();
  await expect(rail).toBeHidden();
});

test("select each original turn and report its message IDs when repeated prompts share a row", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/chat-ui/components/chat-panel-width.canvas.tsx#ConversationOutline",
  );
  await preview.getByRole("button", { name: "Show repeated prompts" }).click();
  const rail = preview.getByRole("navigation", { name: "Conversation outline" });
  const turns = rail.getByRole("button", { name: "Check for available work.", exact: true });
  await expect(turns).toHaveCount(2);
  const first = turns.nth(0);
  const retry = turns.nth(1);
  await expect(first).toHaveAttribute("aria-current", "location");
  await first.focus();
  await first.press("ArrowDown");
  await expect(retry).toBeFocused();
  await retry.press("Enter");
  await expect(retry).toHaveAttribute("aria-current", "location");
  await expect(first).not.toHaveAttribute("aria-current", "location");
  await expect(preview.locator('[data-chat-message-id="poll-0"]')).toBeInViewport();
  await expect(preview.locator('[data-chat-message-id="poll-1"]')).toHaveCount(0);
  const visible = preview.getByTestId("visible-message-ids");
  for (const id of ["poll-0", "poll-1", "error-0", "error-1"]) {
    await expect(visible).toContainText(id);
  }
});
