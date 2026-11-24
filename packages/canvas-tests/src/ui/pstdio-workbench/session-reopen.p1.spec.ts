import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical regression: dismissing an open panel preserves history, and reopening a closed session shows the latest reply.
test("preserves reading position when hiding and resets it when reopening", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/renderers/chat/native-chat.canvas.tsx#ReopenSession",
  );
  const latest = preview.getByText(/^Response 24\./);
  const jump = preview.getByRole("button", { name: "Scroll to latest message" });
  const viewport = preview.getByRole("log").locator(':scope > [data-scope="scroll-area"] > [data-part="viewport"]');
  await expect(latest).toBeInViewport();
  await viewport.press("PageUp");
  await expect(jump).toBeVisible();
  await expect(latest).not.toBeInViewport();

  await preview.getByRole("button", { name: "Hide panel", exact: true }).click();
  await expect(viewport).toBeHidden();
  await preview.getByRole("button", { name: "Show panel", exact: true }).click();
  await expect(jump).toBeVisible();
  await expect(latest).not.toBeInViewport();

  await preview.getByRole("button", { name: "Close session", exact: true }).click();
  await expect(viewport).toBeHidden();
  await preview.getByRole("button", { name: "Reopen session", exact: true }).click();
  await expect(latest).toBeInViewport();
  await expect(jump).toBeHidden();
});
