import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "./mermaid-renderer-storybook";

const prefix = "pstdio-workbench-reference-core-api-panel-policy--";
let baseUrl: string;
let storybook: ChildProcessWithoutNullStreams | undefined;
test.beforeAll(async () => {
  ({ baseUrl, storybook } = await startStorybook(`${prefix}shared-controls`, "pstdio-workbench"));
});
test.afterAll(async () => {
  await stopStorybook(storybook);
});

for (const region of ["Side", "Bottom"] as const) {
  test(`${region} header supports keyboard hiding and showing without changing Main`, async ({ page }) => {
    await page.goto(storyUrl(baseUrl, `${prefix}shared-controls`));
    await waitForStoryPlayback(page);
    const header = page.getByLabel(`${region} panel header`, { exact: true });
    await header.focus();
    await header.press("Shift+F10");
    await page.getByRole("menuitem", { name: "Hide header" }).click();
    const edge = page.getByLabel(`${region} header edge`, { exact: true });
    await expect(edge).toBeVisible();
    await edge.focus();
    await edge.press("ContextMenu");
    await page.getByRole("menuitem", { name: "Show header" }).click();
    await expect(header).toBeVisible();
    await expect(page.getByText("Main page content")).toBeVisible();
    const controls = page.getByRole("group", { name: "Panel controls" });
    await controls.getByRole("button", { name: `Hide ${region} Panel` }).click();
    await expect(controls.getByRole("button", { name: `Show ${region} Panel` })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await controls.getByRole("button", { name: `Show ${region} Panel` }).click();
    await expect(header).toBeVisible();
  });
}
for (const story of ["hidden-headers", "restricted-panels", "legacy-headers", "floating-header"]) {
  test(`panel policy ${story}`, async ({ page }) => {
    await page.goto(storyUrl(baseUrl, `${prefix}${story}`));
    await waitForStoryPlayback(page);
    await expect(page.getByText("Main page content")).toBeVisible();
    if (story === "hidden-headers") {
      await expect(page.getByLabel("Side header edge", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Bottom header edge", { exact: true })).toBeVisible();
    }
    if (story === "legacy-headers") await expect(page.getByLabel("Side panel header", { exact: true })).toBeVisible();
    if (story === "floating-header") {
      const header = page.getByLabel("Side panel header", { exact: true });
      await header.click({ button: "right" });
      await page.getByRole("menuitem", { name: "Hide header" }).click();
      await expect(page.getByLabel("Side header edge", { exact: true })).toBeVisible();
    }
  });
}

for (const name of [
  "single-available-fixed-panel",
  "multiple-available-fixed-panels",
  "collapsed-menu-with-tab",
  "header-action-without-tabs",
  "header-action-for-panel-resource",
]) {
  test(`existing header story ${name}`, async ({ page }) => {
    await page.goto(storyUrl(baseUrl, `pstdio-workbench-reference-core-api-panel-header-visibility--${name}`));
    await waitForStoryPlayback(page);
  });
}

test("touch hold opens the header visibility action", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, `${prefix}hidden-headers`));
  await waitForStoryPlayback(page);
  const edge = page.getByLabel("Side header edge", { exact: true });
  const box = (await edge.boundingBox())!;
  await edge.dispatchEvent("pointerdown", {
    pointerType: "touch",
    pointerId: 1,
    button: 0,
    buttons: 1,
    isPrimary: true,
    clientX: box.x + 4,
    clientY: box.y + 4,
  });
  await expect(page.getByRole("menuitem", { name: "Show header" })).toBeVisible();
  await edge.dispatchEvent("pointerup", { pointerType: "touch", pointerId: 1 });
  await page.getByRole("menuitem", { name: "Show header" }).click();
  await expect(page.getByLabel("Side panel header", { exact: true })).toBeVisible();
});

test("desktop hosts place the same controls beside project tabs", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, "pstdio-workbench-reference-core-api-title-bar--host-panel-controls"));
  await waitForStoryPlayback(page);
  await expect(page.getByRole("group", { name: "Panel controls" })).toHaveCount(1);
  await expect(page.getByText("Project tabs", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show Side Panel" }).click();
  await expect(page.getByRole("button", { name: "Hide Side Panel" })).toBeVisible();
  await expect(
    page.locator('[data-workbench-region="status"]').getByRole("group", { name: "Panel controls" }),
  ).toHaveCount(0);
});
