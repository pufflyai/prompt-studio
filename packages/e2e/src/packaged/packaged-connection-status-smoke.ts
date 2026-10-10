import { chromium, expect } from "@playwright/test";
import { expectPackagedStatusBarOrder } from "./packaged-status-bar-order";

export const expectPackagedConnectionStatus = async (baseUrl: string, headers: Record<string, string>) => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ extraHTTPHeaders: headers });
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await page.goto(baseUrl);
    await page.getByRole("option", { name: "Settings", exact: true }).click();
    await page.getByText("Connection", { exact: true }).click();
    const toggle = page.getByRole("checkbox", { name: "Show connection status" });
    await expect(toggle).not.toBeChecked();
    await toggle.focus();
    await toggle.press("Space");
    await expect(toggle).toBeChecked();
    const connected = page.getByRole("status", { name: /connected to backend/i, includeHidden: true });
    await expect(connected).toBeVisible();
    await expect(connected).toHaveText("");
    await expect(connected).toHaveCSS("border-top-width", "0px");
    await expect(connected).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(connected.locator("svg")).toHaveCSS("width", "6px");
    await page.reload();
    await expect(toggle).toBeChecked();
    await expect(connected).toBeVisible();
    await expectPackagedStatusBarOrder(page);
    const statusBar = page.locator("[data-workbench-region='status']");
    const barBounds = await statusBar.boundingBox();
    const dotBounds = await connected.locator("svg").boundingBox();
    if (!barBounds || !dotBounds) throw new Error("The connection dot and status bar must be visible.");
    expect(Math.abs(dotBounds.y + dotBounds.height / 2 - barBounds.y - barBounds.height / 2)).toBeLessThan(1);
    expect(barBounds.x + barBounds.width - dotBounds.x - dotBounds.width).toBeGreaterThanOrEqual(12);
    await page.context().setOffline(true);
    await page.evaluate(() => window.stop());
    const warning = page.getByRole("status", { name: /backend connection lost/i, includeHidden: true });
    await expect(warning).toBeVisible();
    await expect(warning).not.toHaveText("");
    await toggle.focus();
    await toggle.press("Space");
    await expect(warning).not.toBeVisible();
    await toggle.press("Space");
    await expect(warning).toBeVisible();
    await page.getByRole("button", { name: "Close Connection", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await warning.focus();
    await expect(
      page.getByRole("tooltip", { name: (await warning.getAttribute("aria-label")) ?? "", exact: true }),
    ).toBeVisible();
    await page.context().setOffline(false);
    await page.reload();
    await expect(connected).toBeVisible();
    await connected.hover();
    await expect(
      page.getByRole("tooltip", { name: (await connected.getAttribute("aria-label")) ?? "", exact: true }),
    ).toBeVisible();
    await page.getByRole("option", { name: "Settings", exact: true }).click();
    await page.getByText("Connection", { exact: true }).click();
    await toggle.focus();
    await toggle.press("Space");
    await expect(connected).not.toBeVisible();
    await page.reload();
    await expect(toggle).not.toBeChecked();
  } finally {
    await browser.close();
  }
};
