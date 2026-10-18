import { chromium, expect, type FrameLocator, type Page } from "@playwright/test";
import { signInBrowser } from "../packaged/packaged-serve-helpers";

interface Fixture {
  timelineUrl: string;
  tickets: number;
  matching: number;
  viewTitle: string;
}

async function selectView(page: Page, timeline: FrameLocator, title: string, edges: number) {
  const saved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith("/preferences/timelineViewState") &&
      response.request().method() === "PUT" &&
      response.ok(),
  );
  const start = performance.now();
  await timeline.getByRole("tab", { name: title, exact: true }).click();
  await expect(timeline.locator("[data-edge-layer] g")).toHaveCount(edges);
  const elapsed = Math.round(performance.now() - start);
  await saved;
  return elapsed;
}

async function checkDeferredViews(timeline: FrameLocator) {
  await timeline.locator("[data-ticket]").first().click();
  await expect(timeline.getByRole("button", { name: "Open ticket", exact: true })).toBeVisible();
  await timeline.getByRole("button", { name: "Close details", exact: true }).click();
  await timeline.getByRole("button", { name: "New track", exact: true }).click();
  const track = timeline.getByRole("dialog", { name: "New feature track", exact: true });
  await expect(track.getByRole("textbox", { name: "Feature track name", exact: true })).toBeVisible();
  await track.press("Escape");
  await timeline.getByRole("button", { name: "Auto Build", exact: true }).click();
  const autoBuild = timeline.getByRole("dialog", { name: "Auto Build", exact: true });
  await expect(autoBuild.locator('[contenteditable="true"]')).toBeVisible();
  await autoBuild.getByRole("button", { name: "Cancel", exact: true }).click();
}

export async function checkPlannerStress(
  fixture: Fixture,
  connection: { apiPort: number; apiToken: string; dashboardUrl: string },
) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      if (window.top === window) localStorage.setItem("onboarding-complete", "true");
    });
    const dashboardOrigin = new URL(connection.dashboardUrl).origin;
    // Vite supplies the isolated token itself; a unified packaged runtime needs browser sign-in.
    if (new URL(connection.dashboardUrl).port === String(connection.apiPort)) {
      await signInBrowser(page, { origin: dashboardOrigin, token: connection.apiToken });
    }
    const session = await page.context().newCDPSession(page);
    await session.send("Performance.enable");
    await session.send("Network.enable");
    let iframeStartedAt: number | undefined;
    const assets = new Map<string, { type: string; bytes: number }>();
    session.on("Network.requestWillBeSent", ({ requestId, request, type }) => {
      const path = new URL(request.url).pathname;
      if (type === "Document" && path.endsWith("/pstdio.pstdio-planner.view.timeline/runtime"))
        iframeStartedAt ??= performance.now();
      if (type && path.includes("/extensions/webviews/") && ["Script", "Stylesheet"].includes(type))
        assets.set(requestId, { type, bytes: 0 });
    });
    session.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => {
      const asset = assets.get(requestId);
      if (asset) asset.bytes = encodedDataLength;
    });
    const started = performance.now();
    const [response] = await Promise.all([
      page.waitForResponse((reply) => reply.url().includes(".command.timeline.plan.read/execute")),
      page.goto(fixture.timelineUrl),
    ]);
    const body = await response.body();
    const plan = JSON.parse(body.toString()).outcome.value as {
      ticketRows: { id: string }[];
      sections: { rows: { instructions: string }[] }[];
    };
    expect(plan.ticketRows).toHaveLength(1000);
    expect(plan.sections.flatMap(({ rows }) => rows)).toHaveLength(1000);
    expect(plan.sections.flatMap(({ rows }) => rows).every(({ instructions }) => instructions === "")).toBe(true);
    const timeline = page.locator('[data-workbench-region="main"]').frameLocator("iframe");
    const focus = timeline.getByRole("tab", { name: fixture.viewTitle, exact: true });
    // A person may have left the persistent stack on All before running this check again.
    await focus.click();
    await expect(focus).toHaveAttribute("aria-selected", "true");
    const cards = timeline.locator("[data-ticket]");
    await cards.first().waitFor();
    await expect(timeline.locator("[data-edge-layer] g")).toHaveCount(20);
    const renderedAt = performance.now();
    const firstOpenMs = Math.round(renderedAt - started);
    const iframeStartupMs = iframeStartedAt === undefined ? null : Math.round(renderedAt - iframeStartedAt);
    const startupAssets = [...assets.values()];
    const webviewStartupTransferBytes = {
      javascript: startupAssets.filter(({ type }) => type === "Script").reduce((sum, { bytes }) => sum + bytes, 0),
      stylesheets: startupAssets.filter(({ type }) => type === "Stylesheet").reduce((sum, { bytes }) => sum + bytes, 0),
    };
    const initiallyMounted = await cards.count();
    expect(initiallyMounted).toBeGreaterThan(0);
    expect(initiallyMounted).toBeLessThanOrEqual(25);
    for (let step = 0; step < 8; step++) await timeline.getByRole("button", { name: "Zoom out", exact: true }).click();
    // At 25%, every filtered card fits. This distinguishes filtering from card windowing.
    await expect(cards).toHaveCount(25);
    await timeline.getByRole("button", { name: /^Reset zoom to 100%, current zoom/ }).click();
    const switches = [];
    for (let cycle = 0; cycle < 3; cycle++) {
      const allMs = await selectView(page, timeline, "All", 995);
      const allMounted = await cards.count();
      expect(allMounted).toBeGreaterThan(0);
      expect(allMounted).toBeLessThan(fixture.tickets);
      const focusMs = await selectView(page, timeline, fixture.viewTitle, 20);
      expect(await cards.count()).toBeLessThanOrEqual(fixture.matching);
      switches.push({ allMs, focusMs, allMounted });
    }
    expect(errors).toEqual([]);
    const metrics = await session.send("Performance.getMetrics");
    const heap = metrics.metrics.find(({ name }) => name === "JSHeapUsedSize")?.value;
    await checkDeferredViews(timeline);
    expect(errors).toEqual([]);
    return {
      tickets: fixture.tickets,
      filteredTickets: fixture.matching,
      viewport: "1440x900",
      platform: `${process.platform}/${process.arch}`,
      chromium: browser.version(),
      firstOpenMs,
      iframeStartupMs,
      planReadMs: Math.round(response.request().timing().responseEnd),
      planResponseBytes: body.byteLength,
      webviewStartupTransferBytes,
      initiallyMounted,
      zoomedOutMatchingCards: 25,
      switches,
      pageJsHeapMB: heap === undefined ? null : Math.round(heap / 1024 / 1024),
      browserErrors: errors.length,
    };
  } finally {
    await browser.close();
  }
}
