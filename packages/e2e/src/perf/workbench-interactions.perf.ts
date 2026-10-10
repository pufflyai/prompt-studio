import { expect, type Locator, type Page, test } from "@playwright/test";
import { createProjectViaApi, deleteAllProjects } from "../ui/helpers/session-follow-up";
import {
  afterTwoFrames,
  collectRepeatSamples,
  PERF_START_ATTRIBUTE,
  preparePerfPage,
  readInteraction,
  reportSamples,
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
  expect(result.longTasks).toEqual([]);
  return result.duration;
};

test("resizes, closes, and reopens the Secondary Panel within the interaction budget", async ({
  page,
  request,
}, testInfo) => {
  await deleteAllProjects(request);
  const project = await createProjectViaApi(request, "Workbench interactions performance");
  await preparePerfPage(page, project.id);

  await page.goto(`/projects/${project.id}`);
  await expect(page.getByRole("link", { name: "Start", exact: true })).toBeVisible();
  const showSecondary = page.getByRole("button", { name: "Show Secondary Panel" });
  if (await showSecondary.isVisible()) await showSecondary.click();
  await page.locator('[data-workbench-panel-header="secondary"]').getByRole("button", { name: "Add panel" }).click();
  await page.getByRole("menu", { name: "Add panel" }).getByRole("menuitem", { name: "Terminal", exact: true }).click();
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

  const showPanelButton = page.getByRole("button", { name: "Show Secondary Panel" });
  const close = await measure(page, {
    trigger: separator,
    interact: () => separator.press("Home"),
    settledSelector: '[aria-label="Show Secondary Panel"]',
    ready: () => expect(showPanelButton).toBeVisible(),
  });

  const reopen = await measure(page, {
    trigger: showPanelButton,
    interact: () => showPanelButton.click(),
    settledSelector: separatorSelector,
    ready: () => expect(separator).toBeVisible(),
  });

  const results = collectRepeatSamples(testInfo, "workbench-interactions", [{ resize, close, reopen }]);
  if (!results) return;
  expect(results).toHaveLength(testInfo.project.repeatEach);
  for (const interaction of interactions) {
    const summary = reportSamples(
      "workbench-interactions",
      interaction,
      results.map((result) => result[interaction]),
    );
    expect(summary.max).toBeLessThanOrEqual(150);
  }
});
