import { chromium, expect } from "@playwright/test";

export const expectPackagedQueuedEditorCancellation = async (
  baseUrl: string,
  headers: Record<string, string>,
  projectId: string,
  sessionId: string,
) => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ extraHTTPHeaders: headers });
    await page.addInitScript((id) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", id);
    }, projectId);
    const resource = encodeURIComponent(`pstdio://extension-resource/session/${sessionId}`);
    await page.goto(`${baseUrl}/projects/${projectId}/session?resource=${resource}`);
    const editor = page.getByTestId("content-editable").last();
    await expect(editor).toBeEditable();
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
    await browser.close();
  }
};
