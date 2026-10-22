import { expect, type Page } from "@playwright/test";

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
  expect(await frame!.evaluate(() => Reflect.get(window, "packagedRetentionMarker"))).toBe("original context");
};

export const verifyPackagedWebviewDisposal = async (
  page: Page,
  baseUrl: string,
  projectId: string,
  headers: Record<string, string>,
) => {
  const iframe = page.locator('iframe[title="Lab"]');
  const frame = await (await iframe.elementHandle())!.contentFrame();
  const host = await iframe.evaluateHandle((element) => element.closest("[data-workbench-instance]")!.parentElement!);
  const response = await page.request.get(`${baseUrl}/v1/projects/${projectId}/extensions`, { headers });
  expect(response.ok()).toBe(true);
  const { extensions } = (await response.json()) as { extensions: { id: string; installName: string }[] };
  const fixture = extensions.find(({ installName }) => installName === "workbench-fixture");
  expect(fixture).toBeTruthy();
  const disabled = await page.request.patch(`${baseUrl}/v1/projects/${projectId}/extensions/${fixture!.id}`, {
    headers,
    data: { enabled: false },
  });
  expect(disabled.ok()).toBe(true);
  await expect.poll(() => frame!.isDetached()).toBe(true);
  await expect.poll(() => host.evaluate((element) => element.isConnected)).toBe(false);
  expect(await host.evaluate((element) => element.hasChildNodes())).toBe(false);
  await host.dispose();
};
