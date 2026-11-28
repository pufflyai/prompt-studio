import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

test.use({ viewport: { width: 1200, height: 1100 } });

// Critical regression: a single tool-heavy turn must not mount hundreds of hidden editors.
test("long activity stays virtualized within one reply", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/chat-ui/components/chat-panel-long-activity.canvas.tsx#LongActivity",
  );
  const log = preview.getByRole("log");
  const viewport = log.locator(':scope > [data-scope="scroll-area"] > [data-part="viewport"]');
  const answer = log.getByText("The review is complete.", { exact: true });
  const first = log.getByText(/^Reasoning step 1\./);
  const prompt = log.getByText("Review the workspace.", { exact: true });
  const editors = log.locator("[data-lexical-editor]");
  const tools = log.getByText(/^ls src\/step-\d+$/);
  const lastTool = log.getByText("ls src/step-200", { exact: true });
  const lastToolOutput = log.getByText("Found module 200", { exact: true });
  const reply = log.locator('[data-chat-message-id="answer"]');

  const checkTranscript = async () => {
    await expect(answer).toBeInViewport();
    await expect(prompt).toBeInViewport();
    await expect.poll(() => editors.count()).toBeLessThan(30);
    await expect.poll(() => tools.count()).toBeLessThan(30);
    await expect(first).toHaveCount(0);
    await lastTool.click();
    await expect(lastToolOutput).toBeInViewport();

    await viewport.press("Home");
    await expect(first).toBeInViewport();
    await expect(log.getByText(/ls src\/step-1$/)).toBeInViewport();
    await expect(answer).toHaveCount(0);
    await expect(lastToolOutput).toHaveCount(0);
    await expect.poll(() => editors.count()).toBeLessThan(30);
    await expect.poll(() => tools.count()).toBeLessThan(30);

    await log.getByRole("button", { name: "Scroll to latest message" }).click();
    await expect(answer).toBeInViewport();
    await expect(lastToolOutput).toBeInViewport();
    await expect(reply.getByRole("button", { name: "Copy message" })).toHaveCount(1);
  };

  await checkTranscript();
  await preview.getByRole("button", { name: "Replay one message" }).click();
  await checkTranscript();
});
