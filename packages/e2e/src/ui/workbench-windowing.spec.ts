import type { ChildProcess } from "node:child_process";
import { expect, test } from "@playwright/test";
import { movePanelTab } from "../helpers/move-panel-tab";
import { checkFloatingBubblePointer } from "./floating-bubble-interactions";
import {
  STORY_RENDER_TIMEOUT_MS,
  startStorybook,
  stopStorybook,
  storyUrl,
  waitForStoryPlayback,
} from "./mermaid-renderer-storybook";
import {
  exerciseRetainedWebview,
  readWindowingStoryOutcome,
  windowingInteractions,
} from "./workbench-windowing-interactions";

const storyIds = [
  "panel-toggles-default",
  "panel-toggles-side-left",
  "panel-toggles-navigation-right",
  "panel-toggles-mode-status",
  "panel-toggles-hidden-status",
  "panel-toggles-kiln",
  "panel-toggles-boombox",
  "workspace-page-header",
  "ticket-page-header",
  "page-header-without-menus",
  "session-start-empty",
  "session-start-closed",
  "session-start-visible",
  "session-start-fixed",
  "session-start-inactive",
  "view-background-active",
  "view-background-mounted",
  "view-background-legacy-mounted",
  "view-background-legacy-active",
  "smoke",
  "webview",
  "boombox",
  "kiln",
  "page-surface",
  "page-side-ownership",
  "undeclared-page-panels",
  "ticket-panel-menu",
  "page-panel-geometry",
  "page-panels-left-top",
  "narrow-page-side",
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
  "attached-and-floating",
  "bubble-keyboard",
  "bubble-pointer",
  "legacy-panel-headers",
  "fixed-page-transfer",
  "removed-workspace-resource",
  "removed-workspace-contribution",
  "removed-panel-contribution",
  "removed-mode-contribution",
  "removed-session-resource",
  "removed-owner-forbidden-reopen",
  "foreign-context",
  "page-availability",
].map((name) => `pstdio-workbench-guides-windowing--${name}`);
storyIds.push(
  "pstdio-workbench-reference-core-api-panel-menus--legacy-without-page",
  "pstdio-workbench-reference-core-api-panel-menus--reopen-attached",
  "pstdio-workbench-reference-core-api-panel-menus--floating-when-narrow",
  "pstdio-workbench-reference-core-api-panel-menus--floating-embedded-content",
  "pstdio-workbench-reference-core-api-panel-menus--floating-tall-content",
  "pstdio-workbench-reference-core-api-panel-menus--floating-peek-keeps-attached-menu",
  "pstdio-workbench-reference-core-api-panel-menus--floating-peek-keeps-open-preference",
  "pstdio-workbench-reference-core-api-title-bar--desktop-panel-controls",
  "pstdio-workbench-reference-core-api-status-bar--mode-status-with-panel-toggles",
  "pstdio-workbench-guides-tab-actions--pin-and-close",
  "pstdio-workbench-showcases--boombox",
  "pstdio-workbench-showcases--kiln",
  "pstdio-workbench-showcases-dashboard--dashboard",
  "pstdio-workbench-showcases-dashboard--interaction-checks",
  "pstdio-workbench-controls-research-agent--editable",
  "pstdio-workbench-controls-research-agent--read-only",
);

const exercisePageSideDrop = async (page: import("@playwright/test").Page) => {
  const side = page.locator('[data-workbench-panel="side"]');
  const aside = page.locator('[data-workbench-panel="aside"]');
  const tab = side.getByRole("tab", { name: /^Session 2/ });
  const draft = side.getByRole("textbox", { name: "Session draft" });
  await draft.fill("Keep this draft in Workspace 1");
  const mount = await side.getByLabel("Session mount").textContent();
  const source = (await tab.boundingBox())!;
  const target = (await aside.boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await expect(aside.locator("[data-workbench-tab-drop][data-drop-active]")).toBeVisible();
  await page.mouse.up();
  await expect(aside.getByRole("tab", { name: /^Session 2/ })).toBeVisible();
  await expect(aside.getByRole("textbox", { name: "Session draft" })).toHaveValue("Keep this draft in Workspace 1");
  await expect(aside.getByLabel("Session mount").filter({ visible: true })).toHaveText(mount!);
  await page.getByRole("button", { name: "Workspace 2", exact: true }).click();
  await expect(aside).not.toBeVisible();
  await page.getByRole("button", { name: "Workspace 1", exact: true }).click();
  await expect(aside.getByRole("tab", { name: /^Session 2/ })).toBeVisible();
};

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
      const outcome = await readWindowingStoryOutcome(page);
      expect(outcome.errors).toEqual([]);
      expect(outcome.result).toMatchObject({ storyId, status: "success" });
      await checkFloatingBubblePointer(page, storyId);
      if (storyId.endsWith("--page-side-ownership")) await exercisePageSideDrop(page);
      await windowingInteractions[storyId]?.(page);
      if (
        /--(?:foreign-context|page-availability|page-side|undeclared-page|ticket-panel|page-panel|narrow-page|session-start)/.test(
          storyId,
        )
      ) {
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
        await movePanelTab(
          page,
          bottom.getByRole("tab", { name: "Changes", exact: true }),
          main.locator('[data-workbench-region="main"]'),
        );
        await expect(
          main.locator('[data-workbench-panel-header="main"]').getByRole("tab", { name: "Changes", exact: true }),
        ).toBeVisible();
        await expect(draft).toHaveValue("Keep the draft when moving into page bottom");
        await page.getByRole("button", { name: "Session 1", exact: true }).click();
        const sessionTab = page.locator('[data-workbench-panel="side"]').getByRole("tab", { name: /^Session 1/ });
        await movePanelTab(page, sessionTab, bottom);
        await page.getByRole("button", { name: "Sessions", exact: true }).click();
        await expect(bottom).not.toBeVisible();
      }
      if (storyId.endsWith("--webview") || storyId.endsWith("--page-surface-webview")) {
        await exerciseRetainedWebview(page, storyId);
      }
    });
  }
});
