import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical regression: a retained session must show its latest reply when it is reopened.
test("reopens a retained session at the latest response", async ({ page }) => {
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

  await preview.getByRole("button", { name: "Close session" }).click();
  await expect(viewport).toBeHidden();
  await preview.getByRole("button", { name: "Reopen session" }).click();

  await expect(latest).toBeInViewport();
  await expect(jump).toBeHidden();
});
