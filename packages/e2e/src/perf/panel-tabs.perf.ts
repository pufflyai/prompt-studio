import { expect, test } from "@playwright/test";
import { createProjectViaApi, deleteAllProjects } from "../ui/helpers/session-follow-up";
import {
  collectRepeatSamples,
  PERF_START_ATTRIBUTE,
  preparePerfPage,
  readInteraction,
  reportSamples,
  resetInteraction,
} from "./perf-helpers";

const headerSelector = '[data-workbench-panel-header="secondary"]';

test("opens one Panel tab within the interaction budget", async ({ page, request }, testInfo) => {
  await deleteAllProjects(request);
  const project = await createProjectViaApi(request, "Panel tabs performance");
  await preparePerfPage(page, project.id);
  await page.goto(`/projects/${project.id}/tickets`);

  await page.getByRole("button", { name: "Show Secondary Panel", exact: true }).click();
  const header = page.locator(headerSelector);
  await header.getByRole("button", { name: "Add panel", exact: true }).click();
  const terminalItem = page.getByRole("menu", { name: "Add panel" }).getByRole("menuitem", { name: "Terminal" });
  await resetInteraction(page);
  const initialTabs = await terminalItem.evaluate(
    (element, { startAttribute, selector }) => {
      element.setAttribute(startAttribute, "");
      const header = document.querySelector<HTMLElement>(selector);
      if (!header) throw new Error("Secondary Panel header is not mounted");
      const count = header.querySelectorAll('[role="tab"]').length;
      const observer = new MutationObserver(() => {
        if (header.querySelectorAll('[role="tab"]').length <= count) return;
        observer.disconnect();
        window.__perfSettled = performance.now();
      });
      observer.observe(header, { attributes: true, childList: true, subtree: true });
      return count;
    },
    { startAttribute: PERF_START_ATTRIBUTE, selector: headerSelector },
  );

  await terminalItem.click();
  await expect(header.getByRole("tab", { name: /Terminal 1/ })).toHaveAttribute("aria-selected", "true");
  const result = await readInteraction(page);
  const finalTabs = await page.evaluate(
    (selector) => document.querySelector(selector)?.querySelectorAll('[role="tab"]').length ?? 0,
    headerSelector,
  );
  expect(finalTabs - initialTabs).toBe(1);
  expect(result.longTasks).toEqual([]);

  const results = collectRepeatSamples(testInfo, "panel-tabs", [result.duration]);
  if (!results) return;
  expect(results).toHaveLength(testInfo.project.repeatEach);
  expect(reportSamples("panel-tabs", "open-panel", results).max).toBeLessThanOrEqual(150);
});
