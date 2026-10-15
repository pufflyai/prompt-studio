import { expect, type Page } from "@playwright/test";
import { verifyFullscreenWebviewEscape } from "../helpers/fullscreen-webview-escape";

export const verifyPackagedWebviewRetention = async (page: Page) => {
  const iframe = page.locator('iframe[title="Lab"]');
  const frame = await (await iframe.elementHandle())?.contentFrame();
  expect(frame).toBeTruthy();
  await frame!.evaluate(() => Reflect.set(window, "packagedRetentionMarker", "original context"));
  await page.getByRole("button", { name: /packaged-extension-webview/ }).click();
  await expect(iframe).toBeHidden();
  expect(frame!.isDetached()).toBe(false);
  await page.goBack();
  await expect(iframe).toBeVisible();
  await verifyFullscreenWebviewEscape(page, frame!);
  expect(frame!.isDetached()).toBe(false);
  expect(await frame!.evaluate(() => Reflect.get(window, "packagedRetentionMarker"))).toBe("original context");
};
