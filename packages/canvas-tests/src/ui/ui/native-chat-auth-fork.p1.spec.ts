import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

const canvas = "packages/pstdio-workbench/src/react/renderers/chat/native-chat.canvas.tsx";

// Critical: auth setup must not duplicate empty content, and reply actions must remain reachable.
test("native account setup and completed-reply fork retain their own surfaces", async ({ page }) => {
  let preview = await openCanvasPreview(page, `${canvas}#SignInRequired`);
  await expect(preview.getByRole("button", { name: "Sign in", exact: true })).toHaveCount(1);
  await expect(preview.getByText("No messages yet", { exact: true })).toHaveCount(0);
  await expect(preview.locator('[contenteditable="true"]')).toBeVisible();
  preview = await openCanvasPreview(page, `${canvas}#AuthenticationChecking`);
  await expect(preview.getByText("No messages yet", { exact: true })).toBeVisible();
  await expect(preview.getByText("Checking harness authentication…", { exact: true })).toHaveCount(0);
  preview = await openCanvasPreview(page, `${canvas}#ForkableReply`);
  await preview.locator('[data-chat-message-id="completed-reply"]').hover();
  await expect(preview.getByRole("button", { name: "Copy message", exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Fork conversation", exact: true }).click();
  await expect(preview.getByTestId("forked-message")).toHaveText("completed-reply");
  preview = await openCanvasPreview(page, `${canvas}#ReadOnlyFork`);
  await preview.locator('[data-chat-message-id="completed-reply"]').hover();
  const fork = preview.getByRole("button", { name: "Fork conversation", exact: true });
  await expect(fork).toBeVisible();
  await expect(fork).toHaveAttribute("aria-disabled", "true");
  await expect(fork).toHaveAttribute("title", "This conversation is read only.");
  // aria-disabled keeps its explanation discoverable; even a dispatched click must not invoke the action.
  await fork.dispatchEvent("click");
  await expect(preview.getByTestId("forked-message")).toHaveText("");
});

// Critical: a failed message action must not create a misleading transcript-reconnection failure.
test("failed reply fork stays beside its message without a conversation Retry footer", async ({ page }) => {
  const preview = await openCanvasPreview(page, `${canvas}#ForkFailure`);
  const editor = preview.locator('[contenteditable="true"]');
  await editor.fill("Keep my unsent draft");
  const reply = preview.locator('[data-chat-message-id="completed-reply"]');
  await reply.hover();
  await reply.getByRole("button", { name: "Fork conversation", exact: true }).click();
  await expect(reply.getByRole("alert")).toHaveText("This harness does not support forking conversations.");
  await expect(preview.getByRole("alert")).toHaveCount(1);
  await expect(preview.getByRole("button", { name: "Retry", exact: true })).toHaveCount(0);
  await expect(editor).toHaveText("Keep my unsent draft");
});
