import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { BrowserContext } from "playwright-core";
import { observeSmokePage } from "./smoke-observations";
import { completeSmokeCoverage, planSmokePages } from "./smoke-plan";
import type { SmokeResult } from "./smoke-result";
import { checkSmokeComposition, visitSmokePage, waitForSmokeCondition } from "./smoke-visit";

export const exerciseSmokeDashboard = async (input: {
  context: BrowserContext;
  origin: string;
  projectId: string;
  inventory: WorkbenchExtensionMetadata;
  result: SmokeResult;
  logPath: string;
  signal: AbortSignal;
}) => {
  const { context, origin, projectId, inventory, result, signal } = input;
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const observation = observeSmokePage(page, result, input.logPath);
  const abort = () => {
    void context.close();
  };
  signal.addEventListener("abort", abort, { once: true });
  const extensionId = result.extension!.id;
  const plan = planSmokePages(inventory.pages, extensionId, projectId);
  result.coverage.unexercised.push(...plan.unexercised);
  try {
    await page.goto(`${origin}/projects/${projectId}`);
    await waitForSmokeCondition(
      () => observation.events.some((event) => event.event === "registration-ready" && event.projectId === projectId),
      signal,
    );
    const registrationFailed = observation.events.some((event) => event.event === "registration-error");
    result.checks.push({ id: "host-registration", status: registrationFailed ? "failed" : "passed", extensionId });
    if (registrationFailed) {
      result.exitCode = Math.max(result.exitCode, 1);
      for (const item of plan.pages)
        result.checks.push({
          id: "page-load",
          status: "not-run",
          contributionId: item.page.id,
          message: "Host registration failed.",
        });
      return;
    }
    await page.locator('[data-workbench-panel="main"][data-workbench-page]').waitFor();
    await checkSmokeComposition({ page, origin, projectId, inventory, result, signal, observation }, 0);
    for (const item of plan.pages)
      await visitSmokePage({ page, origin, projectId, inventory, result, signal, observation }, item);
  } finally {
    signal.removeEventListener("abort", abort);
    if (result.evidence) await page.screenshot({ path: `${result.evidence.directory}/dashboard.png` }).catch(() => {});
    await context.close();
    completeSmokeCoverage(
      inventory,
      result,
      plan.pages.map((item) => item.page.id),
    );
  }
};
