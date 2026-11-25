import { chromium, expect } from "@playwright/test";
import { PACKAGED_DASHBOARD_BROWSER } from "../src/packaged/packaged-chromium";
import { type RuntimeDescriptor, runtimeAuthorization, signInBrowser } from "../src/packaged/packaged-serve-helpers";

export const measurePlannerBrowserUpgrade = async (input: {
  runtime: RuntimeDescriptor;
  projectId: string;
  extensionId: string;
  displayName: string;
  previousVersion: string;
  version: string;
}) => {
  const { runtime, projectId, extensionId, previousVersion, version } = input;
  const project = `/v1/projects/${projectId}/extensions`;
  const browser = await chromium.launch(PACKAGED_DASHBOARD_BROWSER);
  try {
    const page = await browser.newPage();
    await page.addInitScript((id) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", id);
    }, projectId);
    await signInBrowser(page, runtime, `/projects/${projectId}/extensions`);
    const row = page.getByTestId("extension-entry").filter({ has: page.getByText(input.displayName, { exact: true }) });
    await expect(row).toContainText(`v${previousVersion}`, { timeout: 30_000 });
    const button = row.getByTestId("extension-row-upgrade");
    await expect(button).toBeEnabled();

    await button.evaluate((element) => {
      element.addEventListener("click", () => performance.mark("planner-upgrade-click"), { capture: true, once: true });
    });
    const response = page.waitForResponse(
      (reply) =>
        new URL(reply.url()).pathname === `${project}/${encodeURIComponent(extensionId)}/upgrade` &&
        reply.request().method() === "POST",
    );
    await button.click();
    const result = await response;
    if (!result.ok()) throw new Error(`Planner upgrade returned HTTP ${result.status()}.`);
    if ((await result.json()).extension.version !== version)
      throw new Error("The browser upgrade activated a different version.");

    const [timings] = await Promise.all([
      page.evaluate(
        async ({ commandPath, authorization }) => {
          const clicked = performance.getEntriesByName("planner-upgrade-click", "mark")[0]?.startTime;
          if (clicked === undefined) throw new Error("The Upgrade button click was not recorded.");
          const upgradeMs = Math.round(performance.now() - clicked);
          const command = await fetch(commandPath, {
            method: "POST",
            headers: { ...authorization, "content-type": "application/json" },
            body: "{}",
          });
          if (!command.ok || !(await command.json()).outcome.ok)
            throw new Error("The upgraded Planner command failed.");
          return { upgradeMs, usableMs: Math.round(performance.now() - clicked) };
        },
        {
          commandPath: `${project}/commands/pstdio.planner.command.list-tickets/execute`,
          authorization: runtimeAuthorization(runtime),
        },
      ),
      expect(row).toContainText(`v${version}`),
    ]);
    return timings;
  } finally {
    await browser.close();
  }
};
