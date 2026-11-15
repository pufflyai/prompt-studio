import { expect, type Page } from "@playwright/test";
import {
  isSessionChatAction,
  sessionChatActionCommandId,
  sessionChatActionRoute,
} from "../helpers/session-chat-actions";

export const expectPackagedQueuedSubmission = async (page: Page, sessionId: string) => {
  const editor = page.getByTestId("content-editable").filter({ visible: true }).last();
  const prompt = "Check the pending queue submission";
  const held = Promise.withResolvers<void>();
  const path = sessionChatActionRoute;
  await page.route(path, async (route) => {
    if (!isSessionChatAction(route.request(), "submit")) return route.continue();
    expect(route.request().postDataJSON().params.renderer.resource.id).toBe(sessionId);
    await held.promise;
    await route.fulfill({
      json: {
        commandId: sessionChatActionCommandId,
        extensionId: "pstdio.session-browser",
        outcome: {
          ok: false,
          status: "error",
          reason: "Could not send",
          error: { message: "Could not send" },
          notices: [],
        },
      },
    });
  });
  await editor.fill(prompt);
  const send = page.getByTestId("send-message-button").filter({ visible: true }).last();
  await expect(send).toBeEnabled();
  await expect(send).toHaveAttribute("aria-label", "Queue message");
  await send.click();
  try {
    const row = page.locator("[data-queued-follow-up-id]").filter({ hasText: prompt, visible: true });
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute("aria-busy", "true");
    await expect(row.getByRole("button", { name: `Edit queued message: ${prompt}` })).toBeDisabled();
    await expect(row.getByRole("button", { name: /Drag queued follow-up/ })).toBeDisabled();
    await expect(row.getByRole("button", { name: "Remove queued follow-up" })).toHaveCount(0);
    await expect(page.getByRole("log").getByText(prompt, { exact: true })).toHaveCount(0);
    const rows = page.locator("[data-queued-follow-up-id]").filter({ visible: true });
    const first = await rows
      .nth(0)
      .getByRole("button", { name: /Edit queued message/ })
      .getAttribute("aria-label");
    const second = await rows
      .nth(1)
      .getByRole("button", { name: /Edit queued message/ })
      .getAttribute("aria-label");
    const secondGrip = page.getByRole("button", { name: "Drag queued follow-up 2", exact: true });
    for (const label of [second, first]) {
      const handle = await secondGrip.boundingBox();
      expect(handle).not.toBeNull();
      await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
      await page.mouse.down();
      await page.mouse.move(handle!.x + handle!.width / 2 + 8, handle!.y + handle!.height / 2);
      await expect(rows.nth(1)).toHaveAttribute("data-drag-source", "true");
      const target = await rows.first().boundingBox();
      expect(target).not.toBeNull();
      await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 8, { steps: 5 });
      // Release only after the UI confirms insertion, rather than a previous combine target.
      await expect(rows.first().locator(':scope > [aria-hidden="true"]')).toBeVisible();
      await expect(rows.first()).toHaveAttribute("data-combine-target", "false");
      await page.mouse.up();
      await expect(rows.first().getByRole("button", { name: label!, exact: true })).toBeVisible();
    }
  } finally {
    held.resolve();
  }
  await expect(page.getByText("Message not sent", { exact: true }).filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(editor).toHaveText(prompt);
  await page.unroute(path);
};
