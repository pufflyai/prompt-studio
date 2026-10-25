import { expect, type Page, test } from "@playwright/test";
import { createProjectViaApi, deleteAllProjects } from "../ui/helpers/session-follow-up";
import {
  afterTwoFrames,
  collectRepeatSamples,
  PERF_START_ATTRIBUTE,
  preparePerfPage,
  readInteraction,
  reportSamples,
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
    const observer = new MutationObserver(() => {
      if (!nav.textContent?.includes(expectedCollection)) return;
      observer.disconnect();
      window.__perfSettled = performance.now();
    });
    observer.observe(nav, { attributes: true, childList: true, subtree: true });
  }, collection);

test("navigates global collections within the interaction budget", async ({ page, request }, testInfo) => {
  await deleteAllProjects(request);
  const project = await createProjectViaApi(request, "Sidenav header performance");
  await waitForTicketsView(request, project.id);
  await preparePerfPage(page, project.id);
  await page.goto(`/projects/${project.id}/tickets`);

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

  const samples: Array<{ collection: Collection; duration: number }> = [];
  for (const collection of collections) {
    await resetInteraction(page);
    await settleWhenNavShows(page, collection);
    await collectionRow(page, collection).click();
    await expect(breadcrumb.getByText(collection, { exact: true })).toBeVisible();
    const result = await readInteraction(page);
    expect(result.longTasks).toEqual([]);
    samples.push({ collection, duration: result.duration });
  }

  const results = collectRepeatSamples(testInfo, "sidenav-header", samples);
  if (!results) return;
  expect(results).toHaveLength(testInfo.project.repeatEach * collections.length);
  for (const collection of collections) {
    const summary = reportSamples(
      "sidenav-header",
      collection,
      results.filter((result) => result.collection === collection).map((result) => result.duration),
    );
    expect(summary.max).toBeLessThanOrEqual(150);
  }
});
