import { expect, type Locator, type Page, test } from "@playwright/test";
import { workbenchBudgets } from "pstdio-benchmarks";
import { createProjectViaApi, deleteAllProjects } from "../ui/helpers/session-follow-up";
import {
  afterTwoFrames,
  budgetMisses,
  PERF_START_ATTRIBUTE,
  preparePerfPage,
  readInteraction,
  reportPageMemory,
  resetInteraction,
  settleWhenVisible,
} from "./perf-helpers";

const interactions = ["resize", "close", "reopen"] as const;

interface InteractionInput {
  trigger: Locator;
  interact: () => Promise<void>;
  // The page stamps completion when this selector first matches a visible element.
  settledSelector: string;
  ready: () => Promise<void>;
}

const measure = async (page: Page, input: InteractionInput) => {
  await resetInteraction(page);
  await input.trigger.evaluate(
    (element, startAttribute) => element.setAttribute(startAttribute, ""),
    PERF_START_ATTRIBUTE,
  );
  await settleWhenVisible(page, input.settledSelector);
  await input.interact();
  await input.ready();
  const result = await readInteraction(page);
  // Set on 2026-10-26 from four hosted ubuntu-24.04 runs (slowest long task 148 ms) plus about 20%.
  expect(
    budgetMisses(
      "workbench-interactions",
      "long-task",
      [Math.max(0, ...result.longTasks)],
      workbenchBudgets.interactionLongTask.value,
    ),
  ).toEqual([]);
  return result.duration;
};

test("resizes, closes, and reopens the Secondary Panel within the interaction budget", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProjectViaApi(request, "Workbench interactions performance");
  await preparePerfPage(page, project.id);

  await page.goto(`/projects/${project.id}`);
  await expect(page.frameLocator('iframe[title="Home"]').getByTestId("start-page")).toBeVisible();
  const showSecondary = page.getByRole("button", { name: "Show Bottom Panel" });
  if (await showSecondary.isVisible()) await showSecondary.click();
  await page.locator('[data-workbench-panel-header="secondary"]').getByRole("button", { name: "Add panel" }).click();
  await page
    .getByRole("menu", { name: "Add panel" })
    .getByRole("menuitem", { name: "Open terminal", exact: true })
    .click();
  const separator = page.getByRole("separator", { name: "Resize Secondary Panel" });
  await expect(separator).toBeVisible();
  await expect(page.locator(".xterm").first()).toBeVisible();
  await afterTwoFrames(page);

  const separatorSelector = '[role="separator"][aria-label="Resize Secondary Panel"]';
  const resizedSize = String(Number(await separator.getAttribute("aria-valuenow")) + 24);
  const resize = await measure(page, {
    trigger: separator,
    interact: () => separator.press("ArrowUp"),
    settledSelector: `${separatorSelector}[aria-valuenow="${resizedSize}"]`,
    ready: () => expect(separator).toHaveAttribute("aria-valuenow", resizedSize),
  });

  const showPanelButton = page.getByRole("button", { name: "Show Bottom Panel" });
  const close = await measure(page, {
    trigger: separator,
    interact: () => separator.press("Home"),
    settledSelector: '[aria-label="Show Bottom Panel"]',
    ready: () => expect(showPanelButton).toBeVisible(),
  });

  const reopen = await measure(page, {
    trigger: showPanelButton,
    interact: () => showPanelButton.click(),
    // A collapsed panel keeps its separator in the DOM, so only the expanded separator ends the sample.
    settledSelector: `${separatorSelector}[data-collapsed="false"]`,
    ready: () => expect(separator).toBeVisible(),
  });

  await reportPageMemory(page, "workbench-interactions");

  const results = [{ resize, close, reopen }];
  expect(results).toHaveLength(1);
  const misses = interactions.flatMap((interaction) =>
    budgetMisses(
      "workbench-interactions",
      interaction,
      results.map((result) => result[interaction]),
      // Set on 2026-10-26 from hosted ubuntu-24.04 runs (slowest 356.5 ms) plus about 20%.
      workbenchBudgets.interactions.value,
    ),
  );
  expect(misses).toEqual([]);
});

let diagnosticProfile: Awaited<ReturnType<import("@playwright/test").BrowserContext["newCDPSession"]>> | undefined;
test.beforeEach(async ({ page }) => {
  diagnosticProfile = await page.context().newCDPSession(page);
  await diagnosticProfile.send("Profiler.enable");
  await diagnosticProfile.send("Profiler.start");
  page.on("pageerror", (error) => console.info("Diagnostic page error", error.message));
  page.on("requestfailed", (request) =>
    console.info("Diagnostic failed request", new URL(request.url()).pathname, request.failure()?.errorText),
  );
});
test.afterEach(async ({ page }, info) => {
  if (diagnosticProfile)
    await info.attach("release-cpu-profile.json", {
      contentType: "application/json",
      body: JSON.stringify(await diagnosticProfile.send("Profiler.stop").catch(() => null)),
    });
  if (info.status !== "passed")
    await info.attach("release-page-state.json", {
      contentType: "application/json",
      body: JSON.stringify(
        await page
          .evaluate(() => ({
            url: location.pathname,
            frames: [...document.querySelectorAll("iframe")].map((frame) => ({
              title: frame.title,
              src: frame.getAttribute("src"),
            })),
          }))
          .catch(() => null),
      ),
    });
});
