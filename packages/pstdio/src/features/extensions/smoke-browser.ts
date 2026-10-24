import { readFileSync } from "node:fs";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { BrowserContext } from "playwright-core";
import { observeSmokePage, summarizeSmokeBrowserLog } from "./smoke-observations";
import { completeSmokeCoverage, planSmokePages } from "./smoke-plan";
import type { SmokeResult } from "./smoke-result";
import { checkSmokeComposition, visitSmokePage, waitForSmokeCondition } from "./smoke-visit";

export const exerciseSmokeDashboard = async (input: {
  context: BrowserContext;
  origin: string;
  loginUrl: string;
  projectId: string;
  inventory: WorkbenchExtensionMetadata;
  result: SmokeResult;
  logPath: string;
  signal: AbortSignal;
}) => {
  const { context, origin, loginUrl, projectId, inventory, result, signal } = input;
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const observation = observeSmokePage(page, result, input.logPath);
  const abort = () => {
    void context.close().catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  const extensionId = result.extension!.id;
  const plan = planSmokePages(inventory.pages, extensionId, projectId);
  result.coverage.unexercised.push(...plan.unexercised);
  try {
    // The dashboard redeems the login code on any page, so the first page signs the browser in.
    const projectPage = new URL(loginUrl);
    projectPage.pathname = `/projects/${projectId}`;
    await page.goto(projectPage.toString());
    await waitForSmokeCondition(
      () => observation.events.some((event) => event.event === "registration-ready" && event.projectId === projectId),
      signal,
    ).catch((error: unknown) => {
      signal.throwIfAborted();
      const url = new URL(page.url());
      const diagnostic = {
        page: `${url.origin}${url.pathname}`,
        hostEvents: observation.events,
        pending: [...observation.pending].map((request) => {
          const pendingUrl = new URL(request.url());
          return `${pendingUrl.origin}${pendingUrl.pathname}`;
        }),
        browserLog: summarizeSmokeBrowserLog(readFileSync(input.logPath, "utf8")),
      };
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${message}\nRegistration diagnostics: ${JSON.stringify(diagnostic)}`, { cause: error });
    });
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
    completeSmokeCoverage(
      inventory,
      result,
      plan.pages.map((item) => item.page.id),
    );
  }
};
