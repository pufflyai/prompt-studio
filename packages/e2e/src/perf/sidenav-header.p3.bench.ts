import { expect, type Page, test } from "@playwright/test";
import { workbenchBudgets } from "pstdio-benchmarks";
import { createProjectViaApi, deleteAllProjects } from "../ui/helpers/session-follow-up";
import { showSidenavEntry } from "../ui/helpers/sidenav-navigation";
import {
  afterTwoFrames,
  budgetMisses,
  checkPerformance,
  PERF_START_ATTRIBUTE,
  preparePerfPage,
  readInteraction,
  reportPageMemory,
  resetInteraction,
  waitForTicketsView,
} from "./perf-helpers";

// Sessions opens its own Sidenav level, so it is not a header-to-header navigation.
const collections = ["Workspaces", "Tickets"] as const;

type Collection = (typeof collections)[number];

const collectionRow = (page: Page, collection: Collection) =>
  page
    .locator('[data-workbench-region="sidenav"]')
    .getByRole("option", collection === "Workspaces" ? { name: /^Workspaces/ } : { name: collection, exact: true });

const settleWhenNavShows = (page: Page, collection: Collection) =>
  page.evaluate((expectedCollection) => {
    const nav = document.querySelector<HTMLElement>('[data-workbench-region="nav"]');
    if (!nav) throw new Error("Nav Chrome is not mounted");
    let frame: number | undefined;
    const check = () => {
      frame = undefined;
      if (!nav.textContent?.includes(expectedCollection)) return;
      const header = document.querySelector<HTMLElement>('[data-workbench-panel-header="main"]');
      if (expectedCollection === "Workspaces") {
        const selected = header?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
        if (!selected?.checkVisibility() || !selected.textContent?.includes(expectedCollection)) return;
      } else if (header?.checkVisibility()) return;
      observer.disconnect();
      requestAnimationFrame(() => {
        window.__perfSettled = performance.now();
      });
    };
    const observer = new MutationObserver(() => {
      // Match the rendered state without forcing layout in the input's mutation microtask.
      if (frame === undefined) frame = requestAnimationFrame(check);
    });
    observer.observe(nav.closest('[data-workbench-panel="main"]') ?? nav, {
      attributes: true,
      childList: true,
      subtree: true,
    });
  }, collection);

test("navigates global collections within the interaction budget", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProjectViaApi(request, "Sidenav header performance");
  await waitForTicketsView(request, project.id);
  await preparePerfPage(page, project.id);
  await page.goto(`/projects/${project.id}/tickets`);
  // Workspaces is hidden by default; showing it is setup, outside every sample.
  await showSidenavEntry(page, "Workspaces");

  for (const collection of collections) {
    const target = collectionRow(page, collection);
    await expect(target).toBeVisible({ timeout: 30_000 });
    await target.evaluate((element, startAttribute) => element.setAttribute(startAttribute, ""), PERF_START_ATTRIBUTE);
  }

  // Warm each registered presenter so the sample measures persistent-header navigation,
  // not first-use module hydration after extension bootstrap.
  const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });
  for (const collection of collections) {
    await collectionRow(page, collection).click();
    await expect(breadcrumb.getByText(collection, { exact: true })).toBeVisible();
  }
  await afterTwoFrames(page);

  const samples: Array<{ collection: Collection } & Awaited<ReturnType<typeof readInteraction>>> = [];
  for (const collection of collections) {
    await resetInteraction(page);
    await settleWhenNavShows(page, collection);
    await collectionRow(page, collection).click();
    await expect(breadcrumb.getByText(collection, { exact: true })).toBeVisible();
    const result = await readInteraction(page);
    samples.push({ collection, ...result });
  }

  await reportPageMemory(page, "sidenav-header");

  const results = samples;
  expect(results).toHaveLength(collections.length);
  const misses = collections.flatMap((collection) =>
    budgetMisses(
      "sidenav-header",
      collection,
      results.filter((result) => result.collection === collection).map((result) => result.duration),
      // Set on 2026-10-26 from hosted ubuntu-24.04 runs (slowest 336 ms) plus about 20%.
      workbenchBudgets.sidenavHeader.value,
    ),
  );
  checkPerformance(() => {
    for (const sample of samples) expect(sample.longTasks).toEqual([]);
    expect(misses).toEqual([]);
  });
});
