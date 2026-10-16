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
    const firstOpenMs = Math.round(performance.now() - started);
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
    return {
      tickets: fixture.tickets,
      filteredTickets: fixture.matching,
      viewport: "1440x900",
      platform: `${process.platform}/${process.arch}`,
      chromium: browser.version(),
      firstOpenMs,
      planReadMs: Math.round(response.request().timing().responseEnd),
      planResponseBytes: body.byteLength,
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
