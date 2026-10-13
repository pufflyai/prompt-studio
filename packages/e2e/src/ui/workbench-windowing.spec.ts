import type { ChildProcess } from "node:child_process";
import { expect, test } from "@playwright/test";
import {
  STORY_RENDER_TIMEOUT_MS,
  startStorybook,
  stopStorybook,
  storyUrl,
  waitForStoryPlayback,
} from "./mermaid-renderer-storybook";

const storyIds = [
  "smoke",
  "webview",
  "boombox",
  "kiln",
  "page-surface",
  "page-surface-webview",
  "owner-transfer",
  "files-transfer",
  "note-reuse",
  "note-neighbor",
  "inactive-owner-reload",
  "inactive-main-document",
  "mixed-document-tabs",
  "workspace-catalog",
  "workspace-catalog-close",
  "collection-catalog",
  "mixed-panel-rules",
  "refused-panel-tabs",
  "panel-header-choices",
  "floating-panel-headers",
  "empty-floating-panel-headers",
  "legacy-panel-headers",
  "fixed-page-transfer",
  "foreign-context",
  "page-availability",
].map((name) => `pstdio-workbench-guides-windowing--${name}`);
storyIds.push(
  "pstdio-workbench-showcases-dashboard--dashboard",
  "pstdio-workbench-showcases-dashboard--interaction-checks",
  "pstdio-workbench-controls-research-agent--editable",
  "pstdio-workbench-controls-research-agent--read-only",
);

test.describe("Workbench windowing stories", () => {
  let baseUrl = "";
  let storybook: ChildProcess | undefined;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(
      "pstdio-workbench-reference-core-api-visual-states--page-composition",
      "pstdio-workbench",
    ));
  });

  test.afterAll(async () => {
    await stopStorybook(storybook);
  });

  for (const storyId of storyIds) {
    test(`${storyId} completes its interactions`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto(storyUrl(baseUrl, storyId));
      await page
        .locator("#storybook-root > *")
        .first()
        .waitFor({ state: "attached", timeout: STORY_RENDER_TIMEOUT_MS });
      await waitForStoryPlayback(page);
      const outcome = await page.evaluate(() => {
        const channel = (
          window as unknown as { __STORYBOOK_ADDONS_CHANNEL__?: { last(event: string): unknown[] | undefined } }
        ).__STORYBOOK_ADDONS_CHANNEL__;
        return {
          result: channel?.last("storyFinished")?.[0],
          errors: [
            "storyErrored",
            "storyThrewException",
            "playFunctionThrewException",
            "unhandledErrorsWhilePlaying",
          ].flatMap((event) => channel?.last(event) ?? []),
        };
      });
      expect(outcome.errors).toEqual([]);
      expect(outcome.result).toMatchObject({ storyId, status: "success" });
      if (storyId.endsWith("--foreign-context") || storyId.endsWith("--page-availability")) {
        await test.info().attach("Page context", { body: await page.screenshot(), contentType: "image/png" });
      }
      if (storyId.endsWith("--foreign-context")) {
        await page.getByRole("button", { name: "Session 2", exact: true }).click();
        const foreign = page.getByRole("tab", { name: "Session 2 · Outside this workspace · Project", exact: true });
        const tooltip = page.getByRole("tooltip", { name: "Outside this workspace · Project", exact: true });
        await page.mouse.move(0, 0);
        await foreign.hover();
        await expect(tooltip).toBeVisible();
        await page.mouse.move(0, 0);
        await page.getByRole("button", { name: "Grow Secondary", exact: true }).click();
        await expect(tooltip).not.toBeVisible();
        await foreign.focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Shift+Tab");
        await expect(foreign).toBeFocused();
        await expect(tooltip).toBeVisible();
      }
      if (storyId.endsWith("--page-surface")) {
        const main = page.locator('[data-workbench-panel="main"]');
        const bottom = main.locator('[data-workbench-panel="bottom"]');
        const tab = main.getByRole("tab", { name: "Changes", exact: true });
        await tab.click();
        const draft = page.getByRole("textbox", { name: "Changes draft" });
        await draft.fill("Keep the draft when moving into page bottom");
        const mount = await page.getByLabel("Changes mount").textContent();
        const source = (await tab.boundingBox())!;
        const target = (await bottom.boundingBox())!;
        await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
        await page.mouse.down();
        await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
        await expect(bottom.locator("[data-workbench-tab-drop][data-drop-active]")).toBeVisible();
        await page.mouse.up();
        await expect(bottom.getByRole("tab", { name: "Changes", exact: true })).toBeVisible();
        await expect(draft).toHaveValue("Keep the draft when moving into page bottom");
        await expect(page.getByLabel("Changes mount")).toHaveText(mount!);
        await expect(page.getByLabel("Inspector binding")).toHaveText("Workspace 2");
        await bottom.getByRole("tab", { name: "Changes", exact: true }).focus();
        await page.keyboard.press("Shift+F10");
        await page.getByRole("menuitem", { name: "Move to Main", exact: true }).click();
        await expect(
          main.locator('[data-workbench-panel-header="main"]').getByRole("tab", { name: "Changes", exact: true }),
        ).toBeVisible();
        await expect(draft).toHaveValue("Keep the draft when moving into page bottom");
        await page.getByRole("button", { name: "Session 1", exact: true }).click();
        const sessionTab = page.locator('[data-workbench-panel="side"]').getByRole("tab", { name: /^Session 1/ });
        await sessionTab.focus();
        await page.keyboard.press("Shift+F10");
        await page.getByRole("menuitem", { name: "Move to Page bottom", exact: true }).click();
        await page.getByRole("button", { name: "Sessions", exact: true }).click();
        await expect(bottom).not.toBeVisible();
      }
      if (storyId.endsWith("--webview") || storyId.endsWith("--page-surface-webview")) {
        const webview = page.frameLocator('iframe[title="Windowing webview"]');
        const draft = webview.getByRole("textbox", { name: "Webview draft" });
        const mount = await webview.getByLabel("Webview mount").textContent();
        await draft.fill("Retained iframe draft");
        await expect(draft).toHaveValue("Retained iframe draft");
        await expect(webview.getByLabel("Webview mount")).toHaveText(mount!);
        if (storyId.endsWith("--page-surface-webview")) {
          const bottom = page.locator('[data-workbench-panel="bottom"]');
          const tab = page.getByRole("tab", { name: "Webview", exact: true });
          const source = (await tab.boundingBox())!;
          const target = (await bottom.boundingBox())!;
          await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
          await page.mouse.down();
          await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
          await page.mouse.up();
          await expect(bottom.getByRole("tab", { name: "Webview", exact: true })).toBeVisible();
          await expect(draft).toHaveValue("Retained iframe draft");
          await expect(webview.getByLabel("Webview mount")).toHaveText(mount!);
          await expect(page.getByLabel("Inspector binding")).toHaveText("Workspace 1");
        }
      }
    });
  }
});
