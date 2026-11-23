import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical regression: both retained presentation paths must reopen at the latest reply.
for (const [hide, show] of [
  ["Close session", "Reopen session"],
  ["Hide panel", "Show panel"],
]) {
  test(`${show} returns to the latest response after reading history`, async ({ page }) => {
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

    await preview.getByRole("button", { name: hide, exact: true }).click();
    await expect(viewport).toBeHidden();
    await preview.getByRole("button", { name: show, exact: true }).click();

    await expect(latest).toBeInViewport();
    await expect(jump).toBeHidden();
  });
}
