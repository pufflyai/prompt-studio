import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";
import type { CollectionPage, CollectionPageRequest } from "@pstdio/sdk/extensions";
import { runScenario } from "pstdio-benchmarks/writer";
import { signInBrowser, stopProcess } from "../../packaged/packaged-serve-helpers";
import { afterPaint } from "./desktop-lifecycle";
import { seedHome, startRuntime } from "./planner-fixture";

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
      const requests: {
        rows: { id: string; title?: string; values?: { title?: string } }[];
        bytes: number;
        path: string;
        page?: CollectionPage;
        request?: CollectionPageRequest;
      }[] = [];
      const pending = new Set<Promise<void>>();
      const responseErrors: unknown[] = [];
      page.on("response", (response) => {
        if (!response.url().includes("/commands/") || !response.url().endsWith("/execute")) return;
        const collecting = (async () => {
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
        })();
        pending.add(collecting);
        void collecting.catch((error) => responseErrors.push(error)).finally(() => pending.delete(collecting));
      });
      const counters = async () => {
        const response = await fetch(`${runtime.baseUrl}/runtime/benchmark-counters`, { headers: runtime.headers });
        assert(response.ok, "Native Planner storage counters unavailable");
        const value = (await response.json()) as { sequentialRows: number; indexEntries: number; writes: number };
        assert(Object.values(value).every(Number.isFinite));
        return value;
      };
      const before = await counters();
      const url = `${runtime.baseUrl}/projects/${fixture.projectId}/extensions/pstdio.pstdio-planner/tickets`;
      const rows = page.getByRole("option").filter({ has: page.getByTestId("row-status-icon") });
      const actionable = async () => {
        await expect(rows.first()).toContainText("Planner stress");
        await expect(page.getByRole("button", { name: "Search this view" })).toBeEnabled();
        assert(
          !/\bin-progress\b|default-priority-low|Unavailable field/.test(await page.locator("body").innerText()),
          "Raw stored options reached actionable content",
        );
        await afterPaint(page);
      };
      const cold = performance.now();
      await signInBrowser(page, runtime.descriptor, new URL(url).pathname);
      await actionable();
      capture.record("actionable", performance.now() - cold);
      const pages = () =>
        requests.filter(
          (request) => request.path.endsWith("pstdio.pstdio-planner.view.tickets.kanban.query/execute") && request.page,
        );
      const filter = performance.now();
      await page.getByRole("button", { name: "Search this view" }).click();
      await page.getByRole("textbox", { name: "Search this view" }).fill("Planner stress background");
      await expect(rows.first()).toContainText("Planner stress background");
      await afterPaint(page);
      await Promise.all([...pending]);
      capture.detail("first-pages", requests);
      assert(pages().length > 0, "Planner did not return a bounded cursor page for continuation");
      const searched = () =>
        pages().findLast(
          (result) =>
            result.request?.search === "Planner stress background" &&
            result.request.offset === 0 &&
            !result.request.cursor,
        );
      await expect.poll(() => Boolean(searched())).toBe(true);
      const initial = searched()!;
      assert(initial.page?.cursor, "The fixed search must have another bounded page");
      assert.equal(initial.request?.limit, 100, "Planner must use the fixed 100-row page size");
      capture.record("filter", performance.now() - filter);
      const firstIds = await rows.evaluateAll((elements) => elements.map((element) => element.textContent));
      const pageCount = pages().length;
      const paging = performance.now();
      // Native collections fetch the next bounded page by scrolling, not a table-only button.
      await page.getByLabel("Collection list", { exact: true }).evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      const continuation = () =>
        pages()
          .slice(pageCount)
          .find(
            (result) =>
              result.request?.cursor === initial.page!.cursor &&
              result.request.revision === initial.page!.revision &&
              result.request.offset === initial.request!.offset + initial.request!.limit &&
              result.page!.revision === initial.page!.revision,
          );
      await expect.poll(() => Boolean(continuation())).toBe(true);
      await actionable();
      const secondIds = await rows.evaluateAll((elements) => elements.map((element) => element.textContent));
      assert.notDeepEqual(secondIds, firstIds, "Page navigation retained stale rows");
      capture.record("page", performance.now() - paging);
      const mounted = await rows.count();
      const title = (await rows.first().innerText()).match(
        /Planner stress background \d{4}(?: with a longer title that wraps across several lines of the shared card)?/,
      )?.[0];
      assert(title, "Expected generated ticket title missing");
      await Promise.all([...pending]);
      const ticket = requests
        .flatMap((entry) => entry.rows)
        .find((entry) => (entry.title ?? entry.values?.title) === title);
      assert(ticket, "The visible ticket must have a measured query result identity");
      const moving = performance.now();
      await runtime.execute(fixture.projectId, "update-ticket", { id: ticket.id, status: "In Progress" });
      await expect(rows.filter({ hasText: title })).toContainText("In Progress");
      await afterPaint(page);
      capture.record("move", performance.now() - moving);
      const firstStalls = await page.evaluate(() => Reflect.get(window, "plannerStalls") as number[]);
      const reopening = performance.now();
      await page.reload();
      await actionable();
      const persisted = await runtime.execute<{ statusId: string; title: string }>(fixture.projectId, "get-ticket", {
        id: ticket.id,
      });
      assert.equal(persisted.statusId, "in-progress");
      await page.getByRole("button", { name: "Search this view" }).click();
      await page.getByRole("textbox", { name: "Search this view" }).fill(title);
      await expect(rows.filter({ hasText: title })).toContainText("In Progress");
      await afterPaint(page);
      capture.record("reopen", performance.now() - reopening);
      await Promise.all([...pending]);
      assert.deepEqual(responseErrors, []);
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
      // Preserve scale failures. Retirement does not fix Planner's unbounded current query.
      assert(
        requests.filter((result) => result.page || result.rows.length > 0).every((result) => result.rows.length <= 100),
        "Planner returned more than one bounded page",
      );
      assert(mounted <= 100, "Planner mounted more than one bounded page");
      assert.equal(after.sequentialRows - before.sequentialRows, 0, "Planner performed a full record projection scan");
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
