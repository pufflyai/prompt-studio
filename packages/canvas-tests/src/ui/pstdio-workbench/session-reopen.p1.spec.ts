import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical regression: dismissing an open panel preserves history, and reopening a closed session shows the latest reply.
test("starts at latest when opening a session and keeps the reading position when hiding or selecting it again", async ({
  page,
}) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/renderers/chat/native-chat.canvas.tsx#ReopenSession",
  );
  const latest = preview.getByText(/^Response 24\./);
  const jump = preview.getByRole("button", { name: "Scroll to latest message" });
  const viewport = preview.getByRole("log").locator(':scope > [data-scope="scroll-area"] > [data-part="viewport"]');
  const gap = () => viewport.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop);
  await expect(latest).toBeInViewport();
  await expect.poll(gap).toBeLessThanOrEqual(2);
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
  await expect.poll(gap).toBeLessThanOrEqual(2);

  await viewport.press("PageUp");
  await expect(jump).toBeVisible();
  await preview.getByRole("button", { name: "Select another session", exact: true }).click();
  await expect(viewport).toBeHidden();
  await preview.getByRole("button", { name: "Return to session", exact: true }).click();
  // Nothing new arrived while away, so the reader returns to where they left.
  await expect(jump).toBeVisible();
  await expect(latest).not.toBeInViewport();
});

// Critical regression: hiding a panel while its keyboard scroll is still moving keeps the reading position.
test("preserves reading position when hidden during a keyboard scroll", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/renderers/chat/native-chat.canvas.tsx#ReopenSession",
  );
  const latest = preview.getByText(/^Response 24\./);
  const jump = preview.getByRole("button", { name: "Scroll to latest message" });
  const viewport = preview.getByRole("log").locator(':scope > [data-scope="scroll-area"] > [data-part="viewport"]');
  await expect(latest).toBeInViewport();

  const hide = await preview.getByRole("button", { name: "Hide panel", exact: true }).elementHandle();

  // Hide between two steps of Page Up's smooth scroll, after the reader has left the tail. The click
  // runs in its own task, as a user's click does, so the next step still scrolls the laid-out viewport
  // and its scroll event reaches the hidden one. A click inside the scroll event would hide the
  // viewport before that step.
  await viewport.evaluate((element, button) => {
    const view = element.ownerDocument.defaultView as Window & { readingRow?: Promise<string> };
    view.readingRow = new Promise((resolve) => {
      let steps = 0;
      const hideWhileScrolling = () => {
        if (!element.ownerDocument.querySelector('[aria-label="Scroll to latest message"]')) return;
        if (++steps < 2) return;
        element.removeEventListener("scroll", hideWhileScrolling);
        const bounds = element.getBoundingClientRect();
        const row = [...element.querySelectorAll("p")].find(
          (paragraph) =>
            /^Response \d+\./.test(paragraph.textContent ?? "") &&
            paragraph.getBoundingClientRect().bottom > bounds.top + bounds.height / 3,
        );
        setTimeout(() => (button as HTMLButtonElement).click());
        resolve(row?.textContent?.match(/^Response \d+\./)?.[0] ?? "");
      };
      element.addEventListener("scroll", hideWhileScrolling);
    });
  }, hide);
  await viewport.press("PageUp");
  const readingRow = await viewport.evaluate(
    (element) => (element.ownerDocument.defaultView as Window & { readingRow?: Promise<string> }).readingRow ?? "",
  );
  expect(readingRow).toMatch(/^Response \d+\.$/);
  await expect(viewport).toBeHidden();
  await preview.getByRole("button", { name: "Show panel", exact: true }).click();
  await expect(preview.getByText(new RegExp(`^${readingRow.replace(".", "\\.")}`))).toBeInViewport();
  await expect(jump).toBeVisible();
  await expect(latest).not.toBeInViewport();
});
