import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Locator, type Page, expect as playwrightExpect } from "@playwright/test";
import type { CollectionPage, CollectionPageRequest } from "@pstdio/sdk/extensions";
import { runScenario } from "pstdio-benchmarks/writer";
import { signInBrowser, stopProcess } from "../../packaged/packaged-serve-helpers";
import { afterPaint } from "./desktop-lifecycle";
import { seedHome, startRuntime } from "./planner-fixture";

// An execution allowance lets slow observations finish without changing their performance limits.
const expect = playwrightExpect.configure({ timeout: 30_000 });

const observeQueries = (page: Page) => {
  const requests: {
    rows: { id: string; title?: string; values?: { title?: string } }[];
    bytes: number;
    path: string;
    page?: CollectionPage;
    request?: CollectionPageRequest;
  }[] = [];
  const pending = new Set<Promise<void>>();
  const responseErrors: unknown[] = [];
  page.on("request", (request) => {
    if (!request.url().includes("/commands/") || !request.url().endsWith("/execute")) return;
    const collecting = (async () => {
      const response = await request.response();
      assert(
        response,
        `Planner command has no response (${request.failure()?.errorText ?? "no failure reason"}): ${request.url()}`,
      );
      const body = await response.body();
      const result = JSON.parse(body.toString());
      assert(response.ok() && result.outcome?.status === "success", "Planner command failed");
      const value = result.outcome.value;
      requests.push({
        rows: Array.isArray(value?.rows) ? value.rows : [],
        bytes: body.length,
        path: new URL(response.url()).pathname,
        page: value?.page,
        request: response.request().postDataJSON()?.params?.page,
      });
    })().catch((error) => {
      responseErrors.push(error);
    });
    pending.add(collecting);
    void collecting.finally(() => pending.delete(collecting));
  });
  const drain = async () => {
    while (pending.size) await Promise.all([...pending]);
  };
  return { requests, drain, responseErrors };
};

const actionable = async (page: Page, rows: Locator) => {
  await expect(rows.first()).toContainText("Planner stress");
  await expect(
    page.getByRole("button", { name: "Search this view" }).or(page.getByRole("textbox", { name: "Search this view" })),
  ).toBeEnabled();
  assert(
    !/\bin-progress\b|default-priority-low|Unavailable field/.test(await page.locator("body").innerText()),
    "Raw stored options reached actionable content",
  );
  await afterPaint(page);
};

await runScenario("B6", async (capture) => {
  const home = await mkdtemp(join(tmpdir(), "critical-planner-"));
  try {
    const fixture = await seedHome(home);
    assert.equal(fixture.tickets, 1_000);
    const runtime = await startRuntime(home, fixture.defaultSources);
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: capture.scenario.throttle });
      await page.addInitScript(() => {
        if (window === window.top) localStorage.setItem("onboarding-complete", "true");
        Reflect.set(window, "plannerStalls", []);
        new PerformanceObserver((list) =>
          Reflect.get(window, "plannerStalls").push(...list.getEntries().map((entry) => entry.duration)),
        ).observe({ type: "longtask", buffered: true });
      });
      const { requests, drain, responseErrors } = observeQueries(page);
      const counters = async () => {
        const response = await fetch(`${runtime.baseUrl}/runtime/benchmark-counters`, { headers: runtime.headers });
        assert(response.ok, "Native Planner storage counters unavailable");
        const value = (await response.json()) as {
          sequentialRows: number;
          indexEntries: number;
          writes: number;
          indexReads: { index: string; definition: string | null; scanned: number }[];
        };
        assert([value.sequentialRows, value.indexEntries, value.writes].every(Number.isFinite));
        assert(value.indexReads.every((entry) => Number.isFinite(entry.scanned)));
        return value;
      };
      const before = await counters();
      const url = `${runtime.baseUrl}/projects/${fixture.projectId}/extensions/pstdio.pstdio-planner/tickets`;
      const rows = page.getByRole("option").filter({ has: page.getByTestId("row-status-icon") });
      const cold = performance.now();
      await signInBrowser(page, runtime.descriptor, new URL(url).pathname);
      await actionable(page, rows);
      capture.record("actionable", performance.now() - cold);
      const pages = () =>
        requests.filter(
          (request) =>
            ["pstdio.planner", "pstdio.pstdio-planner"].some((owner) =>
              request.path.endsWith(`${owner}.view.tickets.kanban.query/execute`),
            ) && request.page,
        );
      await drain();
      const paged = pages().length > 0;
      const filter = performance.now();
      await page.getByRole("button", { name: "Search this view" }).click();
      await page.getByRole("textbox", { name: "Search this view" }).fill("Planner stress background");
      await expect(rows.first()).toContainText("Planner stress background");
      // The first row already matches before search; wait for the actual narrowed result.
      await expect(page.getByTestId("view-search-field")).toContainText("975 of 1000");
      await afterPaint(page);
      await drain();
      capture.detail("first-pages", requests);
      const searched = () =>
        pages().findLast(
          (result) =>
            result.request?.search === "Planner stress background" &&
            result.request.offset === 0 &&
            !result.request.cursor,
        );
      if (paged) {
        try {
          await expect.poll(() => Boolean(searched())).toBe(true);
        } catch (error) {
          capture.detail("search-page-unavailable", String(error));
        }
      }
      const initial = searched();
      capture.record("filter", performance.now() - filter);
      const firstIds = await rows.evaluateAll((elements) => elements.map((element) => element.textContent));
      const pageCount = pages().length;
      const paging = performance.now();
      // Native collections fetch the next bounded page by scrolling, not a table-only button.
      await page.getByLabel("Collection list", { exact: true }).evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      const continuation = () =>
        initial?.page?.cursor &&
        pages()
          .slice(pageCount)
          .find(
            (result) =>
              result.request?.cursor === initial.page!.cursor &&
              result.request.revision === initial.page!.revision &&
              result.request.offset === initial.request!.offset + initial.request!.limit &&
              result.page!.revision === initial.page!.revision,
          );
      let observedContinuation: ReturnType<typeof continuation>;
      if (initial?.page?.cursor) {
        try {
          await expect.poll(() => Boolean(continuation())).toBe(true);
          observedContinuation = continuation();
        } catch (error) {
          capture.detail("continuation-unavailable", String(error));
        }
      }
      await actionable(page, rows);
      await expect
        .poll(async () => JSON.stringify(await rows.allTextContents()) !== JSON.stringify(firstIds))
        .toBe(true);
      await drain();
      const secondIds = await rows.allTextContents();
      capture.detail("page-navigation", {
        mode: paged ? "cursor" : "unbounded-scroll",
        initial,
        continuation: observedContinuation ?? null,
      });
      capture.record("page", performance.now() - paging);
      const mounted = await rows.count();
      const title = (await rows.first().innerText()).match(
        /Planner stress background \d{4}(?: with a longer title that wraps across several lines of the shared card)?/,
      )?.[0];
      assert(title, "Expected generated ticket title missing");
      await drain();
      const ticket = requests
        .flatMap((entry) => entry.rows)
        .find((entry) => (entry.title ?? entry.values?.title) === title);
      assert(ticket, "The visible ticket must have a measured query result identity");
      const moving = performance.now();
      await runtime.execute(fixture.projectId, "update-ticket", { id: ticket.id, status: "In Progress" });
      await expect(rows.filter({ hasText: title })).toContainText("In Progress");
      await afterPaint(page);
      // Drain command bodies before navigation discards their CDP resource handles.
      await drain();
      capture.record("move", performance.now() - moving);
      const firstStalls = await page.evaluate(() => Reflect.get(window, "plannerStalls") as number[]);
      const reopening = performance.now();
      await page.reload();
      await actionable(page, rows);
      const persisted = await runtime.execute<{ statusId: string; title: string }>(fixture.projectId, "get-ticket", {
        id: ticket.id,
      });
      assert.equal(persisted.statusId, "in-progress");
      if (!(await page.getByRole("textbox", { name: "Search this view" }).isVisible()))
        await page.getByRole("button", { name: "Search this view" }).click();
      await page.getByRole("textbox", { name: "Search this view" }).fill(title);
      await expect(rows.filter({ hasText: title })).toContainText("In Progress");
      await afterPaint(page);
      capture.record("reopen", performance.now() - reopening);
      await drain();
      capture.detail("query-response-errors", responseErrors.map(String));
      capture.check("complete-query-response-evidence", responseErrors.length === 0);
      const after = await counters();
      const stalls = [...firstStalls, ...(await page.evaluate(() => Reflect.get(window, "plannerStalls") as number[]))];
      capture.detail("native-counters", { before, after, requests, firstIds, secondIds, stalls });
      const scanned = after.sequentialRows + after.indexEntries - before.sequentialRows - before.indexEntries;
      capture.record("longest-stall", stalls.length ? Math.max(...stalls) : 0);
      capture.record("rows-scanned", scanned);
      capture.record(
        "rows-returned",
        requests.reduce((sum, result) => sum + result.rows.length, 0),
      );
      capture.record(
        "transferred",
        requests.reduce((sum, result) => sum + result.bytes, 0),
      );
      capture.record("mounted", mounted);
      capture.record("writes", after.writes - before.writes);
      // Complete the journey before reporting scale failures; an unbounded scroll cannot qualify as paging.
      capture.check("bounded-search-page", Boolean(initial?.page?.cursor && initial.request?.limit === 100));
      capture.check("cursor-continuation", Boolean(observedContinuation));
      capture.check(
        "bounded-query-responses",
        requests.filter((result) => result.page || result.rows.length > 0).every((result) => result.rows.length <= 100),
      );
      capture.check("bounded-mounted-rows", mounted <= 100);
      capture.check("no-full-projection-scan", after.sequentialRows - before.sequentialRows === 0);
    } catch (error) {
      capture.detail(
        "failed-browser-state",
        await Promise.all(
          (browser?.contexts().flatMap((context) => context.pages()) ?? []).map(async (page) => ({
            url: page.url(),
            text: await page
              .locator("body")
              .innerText()
              .catch(() => "unavailable"),
          })),
        ),
      );
      throw error;
    } finally {
      await browser?.close();
      await stopProcess(runtime.child);
    }
  } finally {
    await rm(home, { recursive: true });
  }
});
