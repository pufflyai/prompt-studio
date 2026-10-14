import type { ChildProcess } from "node:child_process";
import { expect, test } from "@playwright/test";
import { checkFloatingBubblePointer } from "./floating-bubble-interactions";
import { exerciseForeignContext } from "./foreign-context-playwright";
import {
  STORY_RENDER_TIMEOUT_MS,
  startStorybook,
  stopStorybook,
  storyUrl,
  waitForStoryPlayback,
} from "./mermaid-renderer-storybook";
import { exercisePageSurface } from "./page-surface-playwright";
import { exerciseClosedEdges, exercisePanelPointer, exerciseTabInsertion } from "./panel-placement-playwright";
import { readStoryOutcome } from "./story-outcome";
import { exerciseWebview } from "./webview-playwright";
import { windowingInteractions } from "./workbench-windowing-interactions";

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
  "whole-panel-placement",
  "action-bar-edges",
  "closed-edge-reveal",
  "tab-insertion",
  "proposal-reopen",
  "player-reopen",
  "moved-declared-tool",
  "legacy-fixed-tool",
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
  ...[
    "single-items",
    "single-resource-page",
    "close-resource-page",
    "hidden-single-tabs",
    "multiple-items",
    "single-closable-panel",
    "single-resource-with-menu",
    "actions-without-tabs",
  ].map((name) => `pstdio-workbench-reference-core-api-panel-tabs--${name}`),
  ...[
    "single-available-fixed-panel",
    "multiple-available-fixed-panels",
    "collapsed-menu-with-tab",
    "header-action-without-tabs",
  ].map((name) => `pstdio-workbench-reference-core-api-panel-header-visibility--${name}`),
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
      const outcome = await readStoryOutcome(page);
      expect(outcome.errors).toEqual([]);
      expect(outcome.result).toMatchObject({ storyId, status: "success" });
      const interactions: Record<string, () => Promise<void>> = {
        "closed-edge-reveal": () => exerciseClosedEdges(page),
        "whole-panel-placement": () => exercisePanelPointer(page),
        "tab-insertion": () => exerciseTabInsertion(page),
        "page-side-ownership": () => exercisePageSideDrop(page),
        "foreign-context": () => exerciseForeignContext(page),
        "page-surface": () => exercisePageSurface(page),
        webview: () => exerciseWebview(page, storyId),
        "page-surface-webview": () => exerciseWebview(page, storyId),
      };
      await interactions[storyId.split("--").at(-1)!]?.();
      await checkFloatingBubblePointer(page, storyId);
      await windowingInteractions[storyId]?.(page);
      if (
        /--(?:foreign-context|page-availability|page-side|undeclared-page|ticket-panel|page-panel|narrow-page|session-start)/.test(
          storyId,
        )
      ) {
        await test.info().attach("Page context", { body: await page.screenshot(), contentType: "image/png" });
      }
    });
  }
});
