import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { writePageParamsExtension } from "../helpers/page-params-extension";
import { uiOrigin } from "../ui-server";

test("shareable page params update history, native queries and server preferences", async ({ page, request }) => {
  const root = await mkdtemp(join(import.meta.dirname, "../../__test-tmp__-page-params-"));
  writePageParamsExtension(root);
  const response = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Page params" }, root),
  });
  expect(response.ok()).toBe(true);
  const project = await response.json();
  try {
    const url = `/projects/${project.id}/extensions/test.page-params/board?range=now-6h`;
    await page.goto(url);
    const view = page.frameLocator('iframe[title="Page params"]:visible');
    await expect(view.locator("#range")).toHaveText("now-6h");
    await page.getByRole("button", { name: "Show Side Panel", exact: true }).click();
    await expect(page.getByText("now-6h", { exact: true })).toBeVisible();
    const history = await page.evaluate(() => window.history.length);
    await view.getByRole("button", { name: "Update range" }).click();
    await expect(page).toHaveURL(/range=now-24h/);
    await expect(view.locator("#range")).toHaveText("now-24h");
    await expect(page.getByText("now-24h", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.history.length)).toBe(history);
    await view.getByRole("button", { name: "Invalid param" }).click();
    await expect(view.locator("#error")).toContainText("page_param_invalid");
    await expect(page).toHaveURL(/range=now-24h/);
    await view.getByRole("button", { name: "Navigate range" }).click();
    await expect(page).toHaveURL(/range=now-7d/);
    expect(await page.evaluate(() => window.history.length)).toBe(history + 1);
    await page.goBack();
    await expect(view.locator("#range")).toHaveText("now-24h");
    await page.getByRole("button", { name: "Close Range rows", exact: true }).click();
    await expect(view.locator("#range")).toHaveText("now-24h");
    await expect(page).toHaveURL(/range=now-24h/);
    await view.getByRole("button", { name: "Open details" }).click();
    await expect(page).toHaveURL(/details\?range=now-7d/);
    await expect(view.locator("#range")).toHaveText("now-7d");
    await page.getByRole("button", { name: "Page params", exact: true }).click();
    await expect(page).toHaveURL(/board\?range=now-24h/);
    await expect(view.locator("#range")).toHaveText("now-24h");
    await view.getByRole("button", { name: "Save preference" }).click();
    await expect(view.locator("#saved")).toHaveText("now-24h");
    await page.reload();
    await expect(view.locator("#saved")).toHaveText("now-24h");
    await expect(view.locator("#range")).toHaveText("now-24h");
    const extensions = await (await request.get(`${uiOrigin}/v1/projects/${project.id}/extensions`)).json();
    const owner = extensions.extensions.find(
      (extension: { installName: string }) => extension.installName === "page-params",
    );
    const preference = await request.get(
      `${uiOrigin}/v1/projects/${project.id}/extensions/${owner.id}/preferences/lastRange`,
    );
    expect(await preference.json()).toEqual({ name: "lastRange", value: "now-24h" });
    const screenshot = test.info().outputPath("page-params.png");
    await page.screenshot({ path: screenshot });
    await test.info().attach("page-params", { path: screenshot, contentType: "image/png" });
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${project.id}`);
    await rm(root, { recursive: true, force: true });
  }
});
