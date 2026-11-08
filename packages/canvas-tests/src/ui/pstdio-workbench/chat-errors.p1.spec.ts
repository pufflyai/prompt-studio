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
  await page.screenshot({ path: test.info().outputPath("conversation-error.png") });
  await alert.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(alert).toHaveCount(0);
  await expect(preview.getByText("Earlier saved reply.", { exact: true })).toBeVisible();
});
