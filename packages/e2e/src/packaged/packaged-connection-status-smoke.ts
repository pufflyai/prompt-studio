import { chromium, expect } from "@playwright/test";

export const expectPackagedConnectionStatus = async (baseUrl: string, headers: Record<string, string>) => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ extraHTTPHeaders: headers });
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await page.goto(baseUrl);
    await page.getByText("Settings", { exact: true }).click();
    await page.getByText("Connection", { exact: true }).click();
    const toggle = page.getByRole("checkbox", { name: "Show connection status" });
    await expect(toggle).not.toBeChecked();
    await toggle.focus();
    await toggle.press("Space");
    await expect(toggle).toBeChecked();
    await page.reload();
    await expect(toggle).toBeChecked();
    await page.context().setOffline(true);
    await page.evaluate(() => window.stop());
    const warning = page.getByRole("status", { name: /backend connection lost/i, includeHidden: true });
    await expect(warning).toBeVisible();
    await expect(warning).not.toHaveText("states.reconnecting");
    await toggle.focus();
    await toggle.press("Space");
    await expect(warning).not.toBeVisible();
    await page.context().setOffline(false);
    await page.reload();
    await expect(toggle).not.toBeChecked();
  } finally {
    await browser.close();
  }
};
