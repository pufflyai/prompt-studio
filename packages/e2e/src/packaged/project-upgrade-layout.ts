import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { PROVISIONED_CHROMIUM } from "./packaged-chromium";
import { type RuntimeDescriptor, signInBrowser } from "./packaged-serve-helpers";

/** Carry the released dashboard's own page and mode layouts across the runtime's change of origin. */
export const captureUpgradeLayouts = async (descriptor: RuntimeDescriptor, projectId: string) => {
  const browser = await chromium.launch(PROVISIONED_CHROMIUM);
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await signInBrowser(page, descriptor, `/projects/${projectId}`);
    await page.getByRole("option", { name: "Extensions", exact: true }).click();
    await expect(page.getByTestId("extensions-search")).toBeVisible();
    // Leaving the page flushes pending layout writes before the baseline shuts down.
    await page.goto("about:blank");
    const { origins } = await page.context().storageState();
    const layouts =
      origins
        .find(({ origin }) => origin === descriptor.origin)
        ?.localStorage.filter(({ name }) => name.startsWith("dashboard-wb2:layout:")) ?? [];
    for (const scope of [
      `project/${projectId}/mode/project/page/extensions`,
      `workbench-mode:${JSON.stringify([projectId, "project"])}`,
    ]) {
      assert(
        layouts.some(({ name }) => name === `dashboard-wb2:layout:${scope}`),
        `Baseline did not save layout for ${scope}`,
      );
    }
    return layouts;
  } finally {
    await browser.close();
  }
};
