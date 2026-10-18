import { type Browser, expect } from "@playwright/test";
import { logQueuedPhase } from "./packaged-queued-fixture";
import { expectPackagedQueuedSubmission } from "./packaged-queued-submission-smoke";

export const expectPackagedQueuedEditorCancellation = async (
  browser: Browser,
  baseUrl: string,
  headers: Record<string, string>,
  projectId: string,
  sessionId: string,
  acceptsLiveInput = true,
) => {
  const page = await browser.newPage({ extraHTTPHeaders: headers });
  try {
    await page.addInitScript((id) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", id);
    }, projectId);
    const resource = encodeURIComponent(`pstdio://extension-resource/session/${sessionId}`);
    logQueuedPhase("editor", "open session page");
    await page.goto(`${baseUrl}/projects/${projectId}/session?resource=${resource}`);
    const editor = page.getByTestId("content-editable").filter({ visible: true }).last();
    await expect(editor).toBeEditable();
    logQueuedPhase("editor", "pending submission and failure recovery");
    await expectPackagedQueuedSubmission(page, sessionId);
    logQueuedPhase("editor", "drag cancellation and independent draft");
    const grip = page.getByRole("button", { name: "Drag queued follow-up 1", exact: true });
    const queue = grip.locator("xpath=ancestor::*[@data-send-now-visible]");
    const topRadius = await queue.evaluate((element) => getComputedStyle(element).borderTopRightRadius);
    await grip.focus();
    await grip.press("Space");
    await expect(page.locator("[data-queued-follow-up-id][data-drag-source=true]")).toHaveCount(1);
    await expect(page.locator("[data-queue-send-now]")).toHaveCount(acceptsLiveInput ? 1 : 0);
    if (!acceptsLiveInput) await expect(queue).toHaveCSS("border-top-right-radius", topRadius);
    await grip.press("Escape");
    const remove = page.getByRole("button", { name: "Remove queued follow-up", exact: true }).first();
    await page.getByRole("button", { name: "Edit queued message: First", exact: true }).hover({ timeout: 5000 });
    expect(
      await remove.evaluate((element) => {
        const row = element.closest("[data-queued-follow-up-id]")!;
        const inset = row.getBoundingClientRect().right - element.getBoundingClientRect().right;
        const padding = Number.parseFloat(getComputedStyle(row).paddingRight);
        return inset - padding;
      }),
    ).toBeGreaterThan(0);
    await expect(remove).toHaveCSS(
      "color",
      await remove.evaluate((element) => {
        const reference = document.createElement("span");
        reference.style.color = "var(--chakra-colors-fg-error)";
        element.append(reference);
        const color = getComputedStyle(reference).color;
        reference.remove();
        return color;
      }),
    );
    await editor.fill("Independent draft");
    await page.getByRole("button", { name: "Edit queued message: First", exact: true }).click();
    await expect(editor).toHaveText("First");
    await editor.fill("Discard this edit");
    await editor.press("Escape");
    await expect(page.getByRole("button", { name: "Update", exact: true })).toHaveCount(0);
    await expect(editor).toHaveText("Independent draft");
    await page.getByRole("button", { name: "Edit queued message: First", exact: true }).click();
    await expect(editor).toHaveText("First");
    await editor.press("Escape");
    await expect(editor).toHaveText("Independent draft");
  } finally {
    await page.close();
  }
};
