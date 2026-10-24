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
  await page.goto(`${baseUrl}/projects/${projectId}/extensions/pstdio.workbench-fixture/lab`, {
    waitUntil: "domcontentloaded",
  });
  const iframe = page.locator('iframe[title="Lab"]');
  await iframe.waitFor({ state: "visible", timeout: 30_000 });
  expect(await iframe.getAttribute("sandbox")).not.toContain("allow-same-origin");

  const frame = page.frameLocator('iframe[title="Lab"]');
  await frame.getByRole("heading", { name: "Sandbox webview" }).waitFor({ timeout: 30_000 });
  await verifyPackagedViewInitialization(page, runtimeUrl);
  await frame.getByRole("button", { name: "Say hello" }).click();
  await page.getByText("Hello from Extension Lab").waitFor({ timeout: 10_000 });

  const bumpResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith("/commands/pstdio.workbench-fixture.command.counter.bump/execute"),
  );
  await frame.getByRole("button", { name: "Increment", exact: true }).click();
  expect((await bumpResponse).status()).toBe(200);
  expect(await (await bumpResponse).json()).toMatchObject({
    outcome: { status: "success", value: { counter: 1 } },
  });
  await page.reload();
  await expect(frame.getByText("1", { exact: true })).toBeVisible();
  await frame.getByRole("button", { name: "Read native controls", exact: true }).press("Enter");
  await expect(frame.getByTestId("native-controls-result")).toContainText('"model":"fake"');
  expect(JSON.parse((await frame.getByTestId("native-controls-result").textContent())!)).toMatchObject({
    model: "fake",
    actions: expect.any(Array),
  });
  await verifyPackagedWebviewRetention(page);
  await verifyPackagedShortcutReference(page, baseUrl, projectId, authorization);

  await page.getByRole("option", { name: "Settings", exact: true }).click();
  await page.getByRole("dialog").last().getByText("Lab (project)", { exact: true }).click();
  const settingsFrame = page.frameLocator('iframe[title="Lab (project)"]');
  expect(await page.locator('iframe[title="Lab (project)"]').getAttribute("sandbox")).not.toContain(
    "allow-same-origin",
  );
  await settingsFrame.getByRole("spinbutton").fill("7");
  await settingsFrame.getByRole("button", { name: "Save", exact: true }).click();
  await expect(settingsFrame.getByText("Saved", { exact: true })).toBeVisible();

  await page.reload();
  await expect(settingsFrame.getByRole("spinbutton")).toHaveValue("7");
  await page.getByRole("button", { name: "Close Lab (project)", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("option", { name: "Settings", exact: true }).click();
  await page.getByRole("dialog").last().getByText("Lab (project)", { exact: true }).click();
  await expect(settingsFrame.getByRole("spinbutton")).toHaveValue("7");
  await page.getByRole("button", { name: "Close Lab (project)", exact: true }).click();
  await page.goto(`${baseUrl}/projects/${projectId}/extensions/pstdio.workbench-fixture/lab`);
  await expect(frame.getByText("1", { exact: true })).toBeVisible();
  await frame.getByRole("button", { name: "Increment", exact: true }).click();
  await expect(frame.getByText("8", { exact: true })).toBeVisible();
};
