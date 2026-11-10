import { expect, type Page } from "@playwright/test";
import { verifyPackagedShortcutReference } from "./packaged-shortcut-reference";
import { verifyPackagedViewInitialization } from "./packaged-webview-initialization";
import { verifyPackagedWebviewRetention } from "./packaged-webview-retention";

export const verifyPackagedOpaqueWebview = async (
  page: Page,
  baseUrl: string,
  projectId: string,
  runtimeUrl: string,
  authorization: Record<string, string>,
) => {
  await page.goto(`${baseUrl}/projects/${projectId}/extensions/test.webview-host/host`, {
    waitUntil: "domcontentloaded",
  });
  const iframe = page.locator('iframe[title="Host page"]');
  await iframe.waitFor({ state: "visible", timeout: 30_000 });
  expect(await iframe.getAttribute("sandbox")).not.toContain("allow-same-origin");

  const frame = page.frameLocator('iframe[title="Host page"]');
  await frame.getByRole("heading", { name: "Host contract" }).waitFor({ timeout: 30_000 });
  await verifyPackagedViewInitialization(page, runtimeUrl);
  const bumpResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith("/commands/test.webview-host.command.bump/execute"),
  );
  await frame.getByRole("button", { name: "Increment", exact: true }).click();
  expect((await bumpResponse).status()).toBe(200);
  expect(await (await bumpResponse).json()).toMatchObject({
    outcome: { status: "success", value: { counter: 1 } },
  });
  await page.reload();
  await expect(frame.getByLabel("Counter")).toHaveText("1");
  await verifyPackagedWebviewRetention(page);
  await verifyPackagedShortcutReference(page, baseUrl, projectId, authorization);

  await page.getByRole("option", { name: "Settings", exact: true }).click();
  await page.getByRole("dialog").last().getByRole("option", { name: "Host settings", exact: true }).click();
  const settings = page.frameLocator('iframe[title="Host settings"]');
  expect(await page.locator('iframe[title="Host settings"]').getAttribute("sandbox")).not.toContain(
    "allow-same-origin",
  );
  await settings.getByRole("spinbutton", { name: "Value" }).fill("7");
  await settings.getByRole("button", { name: "Save", exact: true }).click();
  await expect(settings.getByLabel("Save status")).toHaveText("Saved");
  await page.reload();
  await expect(settings.getByRole("spinbutton", { name: "Value" })).toHaveValue("7");
  await page.getByRole("button", { name: "Close Host settings", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto(`${baseUrl}/projects/${projectId}/extensions/test.webview-host/host`);
  await expect(frame.getByLabel("Counter")).toHaveText("1");
};
