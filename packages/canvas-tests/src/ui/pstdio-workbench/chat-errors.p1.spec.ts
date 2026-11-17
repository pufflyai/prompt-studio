import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: failures must stay readable in the conversation and keep recovery controls usable.
test("native chat errors remain in alerts and Retry restores the conversation", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/renderers/chat/native-chat.canvas.tsx#ConversationFailure",
  );
  const alert = preview.getByRole("alert");
  await expect(alert).toContainText("The conversation connection was lost.");
  await expect(alert.getByRole("button", { name: "Copy error message" })).toBeVisible();
  await expect(alert.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await expect(preview.getByText("Earlier saved reply.", { exact: true })).toBeVisible();
  expect(await alert.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
  const draft = preview.locator(".ps-chat-composer__input").getByRole("textbox");
  const send = preview.getByRole("button", { name: "Send message", exact: true });
  await expect(draft).toBeEditable();
  await draft.fill("Keep writing while disconnected");
  await expect(send).toBeDisabled();
  await page.screenshot({ path: test.info().outputPath("conversation-error.png") });
  await alert.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(alert).toHaveCount(0);
  await expect(draft).toHaveText("Keep writing while disconnected");
  await expect(send).toBeEnabled();
  await expect(preview.getByText("Earlier saved reply.", { exact: true })).toBeVisible();
});
