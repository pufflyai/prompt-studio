import { expect, test } from "@playwright/test";
import { workbenchBudgets } from "pstdio-benchmarks";
import { createProjectViaApi, deleteAllProjects } from "../ui/helpers/session-follow-up";
import {
  budgetMisses,
  checkPerformance,
  PERF_START_ATTRIBUTE,
  preparePerfPage,
  readInteraction,
  reportPageMemory,
  resetInteraction,
} from "./perf-helpers";

const headerSelector = '[data-workbench-panel-header="secondary"]';

test("opens one Panel tab within the interaction budget", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProjectViaApi(request, "Panel tabs performance");
  await preparePerfPage(page, project.id);
  await page.goto(`/projects/${project.id}/tickets`);

  await page.getByRole("button", { name: "Show Bottom Panel", exact: true }).click();
  const header = page.locator(headerSelector);
  await header.getByRole("button", { name: "Add panel", exact: true }).click();
  const terminalItem = page.getByRole("menu", { name: "Add panel" }).getByRole("menuitem", { name: "Open terminal" });
  await resetInteraction(page);
  const initial = await terminalItem.evaluate(
    (element, { startAttribute, selector }) => {
      element.setAttribute(startAttribute, "");
      const header = document.querySelector<HTMLElement>(selector);
      if (!header) throw new Error("Secondary Panel header is not mounted");
      const count = header.querySelectorAll('[role="tab"]').length;
      const ids = Array.from(
        header.querySelectorAll<HTMLElement>("[data-workbench-tab]"),
        (tab) => tab.dataset.workbenchTab!,
      );
      let frame: number | undefined;
      const check = () => {
        frame = undefined;
        const added = Array.from(header.querySelectorAll<HTMLElement>("[data-workbench-tab]")).filter(
          (tab) => !ids.includes(tab.dataset.workbenchTab!),
        );
        const selected =
          added.length === 1 ? added[0]?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') : undefined;
        if (header.querySelectorAll('[role="tab"]').length <= count || !selected?.checkVisibility()) return;
        observer.disconnect();
        // Check layout in a frame, then include its paint before ending the sample.
        requestAnimationFrame(() => {
          window.__perfSettled = performance.now();
        });
      };
      const observer = new MutationObserver(() => {
        // Reading visibility in the mutation microtask forces layout inside the input task.
        if (frame === undefined) frame = requestAnimationFrame(check);
      });
      observer.observe(header, { attributes: true, childList: true, subtree: true });
      return { count, ids };
    },
    { startAttribute: PERF_START_ATTRIBUTE, selector: headerSelector },
  );

  await terminalItem.click();
  // A terminal can rename its tab to the shell before automation reads it.
  await expect
    .poll(() =>
      header
        .locator("[data-workbench-tab]")
        .evaluateAll(
          (tabs, known) =>
            tabs
              .filter((tab) => !known.includes((tab as HTMLElement).dataset.workbenchTab!))
              .map((tab) => tab.querySelector('[role="tab"]')?.getAttribute("aria-selected")),
          initial.ids,
        ),
    )
    .toEqual(["true"]);
  const result = await readInteraction(page);
  const finalTabs = await page.evaluate(
    (selector) => document.querySelector(selector)?.querySelectorAll('[role="tab"]').length ?? 0,
    headerSelector,
  );
  expect(finalTabs - initial.count).toBe(1);
  await expect(page.getByRole("textbox", { name: "Terminal input", exact: true })).toBeVisible();
  await reportPageMemory(page, "panel-tabs");

  const results = [result.duration];
  expect(results).toHaveLength(1);
  // Set on 2026-10-26 from four hosted ubuntu-24.04 runs (slowest 664 ms) plus about 20%.
  const misses = budgetMisses("panel-tabs", "open-panel", results, workbenchBudgets.panelTabs.value);
  checkPerformance(() => {
    expect(result.longTasks).toEqual([]);
    expect(misses).toEqual([]);
  });
});
