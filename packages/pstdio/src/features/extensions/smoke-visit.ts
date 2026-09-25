import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { Page } from "playwright-core";
import type { ExtensionHostDiagnostic } from "pstdio-api/extensions/host-diagnostics";
import type { observeSmokePage } from "./smoke-observations";
import type { SmokeResult } from "./smoke-result";

export const waitForSmokeCondition = async (predicate: () => boolean | Promise<boolean>, signal: AbortSignal) => {
  const deadline = Date.now() + 10_000;
  while (!(await predicate())) {
    signal.throwIfAborted();
    if (Date.now() > deadline) throw new Error("Dashboard readiness deadline exceeded (10000ms).");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};
export const hasHostFailure = (events: ExtensionHostDiagnostic[]) =>
  events.some(
    (event) =>
      event.event === "registration-error" || event.event === "webview-error" || event.event === "webview-diagnostic",
  );
export interface SmokeVisit {
  page: Page;
  origin: string;
  projectId: string;
  inventory: WorkbenchExtensionMetadata;
  result: SmokeResult;
  signal: AbortSignal;
  observation: ReturnType<typeof observeSmokePage>;
}
export const checkSmokeComposition = async (input: SmokeVisit, start: number) => {
  const { page, inventory, result, signal, observation } = input;
  await waitForSmokeCondition(async () => {
    if (observation.pending.size > 0) return false;
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
    return observation.pending.size === 0;
  }, signal);
  if (await page.locator('[data-workbench-renderer="missing"]').count())
    throw new Error("An active view has no registered renderer.");

  const mounted = await page
    .locator('[data-workbench-view][data-workbench-renderer="mounted"]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("data-workbench-view")!));
  for (const view of inventory.views.filter((view) => mounted.includes(view.id))) {
    if (view.body.kind === "webview") {
      await waitForSmokeCondition(
        () =>
          observation.events
            .slice(start)
            .some(
              (event) =>
                event.contributionId === view.id &&
                (event.event === "webview-ready" || event.event === "webview-error"),
            ),
        signal,
      );
      const failed = hasHostFailure(
        observation.events.slice(start).filter((event) => event.contributionId === view.id),
      );
      result.checks.push({
        id: "webview-load",
        status: failed ? "failed" : "passed",
        extensionId: view.extensionId,
        contributionId: view.id,
      });
      if (failed) result.exitCode = Math.max(result.exitCode, 1);
    }
    if (!result.coverage.visited.includes(view.id)) result.coverage.visited.push(view.id);
  }
};
export const visitSmokePage = async (
  input: SmokeVisit,
  item: { page: WorkbenchExtensionMetadata["pages"][number]; url: string },
) => {
  const { page, origin, projectId, result, signal, observation } = input;
  signal.throwIfAborted();
  observation.setPhase(`page:${item.page.id}`);
  const start = observation.events.length;
  try {
    await page.goto(`${origin}${item.url}`);
    await waitForSmokeCondition(
      () =>
        observation.events
          .slice(start)
          .some((event) => event.event === "registration-ready" && event.projectId === projectId),
      signal,
    );
    await page.locator(`[data-workbench-page=${JSON.stringify(item.page.id)}]`).waitFor();
    const main = item.page.main.kind === "view" ? item.page.main.view : item.page.main.empty;
    const mainId = main.extensionId === "pstdio" ? main.id : `${main.extensionId}.view.${main.id}`;
    await page
      .locator(`[data-workbench-view=${JSON.stringify(mainId)}][data-workbench-renderer="mounted"]`)
      .first()
      .waitFor();
    await checkSmokeComposition(input, start);
    const failed = hasHostFailure(observation.events.slice(start));
    result.checks.push({
      id: "page-load",
      status: failed ? "failed" : "passed",
      extensionId: result.extension!.id,
      contributionId: item.page.id,
    });
    result.coverage.visited.push(item.page.id);
    if (failed) result.exitCode = Math.max(result.exitCode, 1);
  } catch (error) {
    signal.throwIfAborted();
    result.exitCode = Math.max(result.exitCode, 1);
    result.checks.push({
      id: "page-load",
      status: "failed",
      extensionId: result.extension!.id,
      contributionId: item.page.id,
      message: String(error),
    });
  }
};
