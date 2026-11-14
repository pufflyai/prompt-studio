import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { cpus, totalmem } from "node:os";
import { join, resolve } from "node:path";
import { type Browser, chromium, expect } from "@playwright/test";
import { benchmarkSampleCount, isBelowBudget, subnavBudgets } from "pstdio-benchmarks";
import { recordMeasurement } from "pstdio-benchmarks/writer";
import { revealTreeEntry } from "../helpers/tree-entry";
import { PROVISIONED_CHROMIUM } from "../packaged/packaged-chromium";
import { PACKAGED_BINARY_PATH } from "../packaged/packaged-helpers";
import { runtimeAuthorization, signInBrowser } from "../packaged/packaged-serve-helpers";
import {
  createSubnavNetworkRecorder,
  installSubnavClock,
  measureSubnav,
  type SubnavSample,
} from "./subnav-benchmark-clock";
import { SUBNAV_WORKLOAD, startSubnavBenchmarkFixture, subnavFixtureRoot } from "./subnav-benchmark-fixture";
import { subnavBenchmarkResults } from "./subnav-benchmark-results";
import { classifySubnavRequests } from "./subnav-request-outcomes";
import { installSubnavRequestSignals } from "./subnav-request-signals";

// Set on 2026-10-26 from four hosted ubuntu-24.04 runs (slowest 293 / 1,263 / 1,089 ms) plus about 20%.
const SUBNAV_BUDGETS = {
  structureMs: subnavBudgets.structureMs.value,
  dataMs: subnavBudgets.dataMs.value,
  editorMs: subnavBudgets.editorMs.value,
};
const sampleCount = benchmarkSampleCount(30);
const label = process.env.SUBNAV_LABEL ?? "current";
const fixture = await startSubnavBenchmarkFixture();
let browser: Browser | undefined;
const samples: SubnavSample[] = [];
const errors: string[] = [];
const output = join(subnavFixtureRoot, "results", label);
let executionReport:
  | { suites: { specs: ReturnType<typeof subnavBenchmarkResults>["specs"] }[]; errors: { message: string }[] }
  | undefined;
try {
  await mkdir(output, { recursive: true });
  browser = await chromium.launch(PROVISIONED_CHROMIUM);
  for (let iteration = 0; iteration < sampleCount; iteration++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    try {
      page.on("pageerror", (error) => errors.push(error.message));
      await installSubnavRequestSignals(page);
      await installSubnavClock(page);
      await page.addInitScript((projectId) => {
        localStorage.setItem("onboarding-complete", "true");
        localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
      }, fixture.project.id);
      const network = createSubnavNetworkRecorder(page);
      if (iteration === 0 && process.env.SUBNAV_TRACE === "1")
        await context.tracing.start({ screenshots: true, snapshots: true });
      await signInBrowser(page, fixture.descriptor);
      const startUrl = `${fixture.baseUrl}/projects/${fixture.project.id}/extensions/pstdio.planner/tickets`;
      await page.goto(startUrl);
      const sidenav = page.locator('[data-workbench-region="sidenav"]');
      await expect(sidenav.getByRole("option", { name: "Sessions", exact: true })).toBeVisible();
      await expect(sidenav.getByRole("option", { name: "Tickets", exact: true })).toBeVisible();
      await network.settled(performance.now());
      for (const visit of ["first", "repeat"] as const) {
        // Open the ticket before Sessions can download shared editor modules.
        const card = page.getByTestId("renderer-card").getByText(fixture.ticket.title, { exact: true });
        await expect(card).toBeVisible();
        await network.settled(performance.now());
        const ticket = await measureSubnav(
          page,
          network,
          card,
          "ticket",
          visit,
          `${fixture.ticket.shorthand} ${fixture.ticket.title}`,
          fixture.ticket.title,
        );
        samples.push(ticket);
        console.info(JSON.stringify({ iteration: iteration + 1, ...ticket }));
        if (visit === "first" && !ticket.requests.some((request) => request.sessionRows === 120))
          errors.push(`Iteration ${iteration + 1} ${visit}: ticket history did not contain all 120 sessions`);
        if (iteration === 0 && visit === "first") await page.screenshot({ path: join(output, "ticket.png") });
        // A warm ticket reuses its history read. Verify all 120 retained rows through
        // the real virtualized tree after timing, then restore the initial position.
        const ticketViewport = sidenav.locator('[data-scope="scroll-area"][data-part="viewport"]').last();
        const history = new Set<string>();
        await ticketViewport.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });
        try {
          for (;;) {
            await page.evaluate(
              () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
            );
            for (const title of await sidenav
              .getByRole("option", { name: /^Benchmark session \d{4}$/ })
              .allTextContents())
              history.add(title.trim());
            if (history.size >= 120) break;
            const moved = await ticketViewport.evaluate((element) => {
              const before = element.scrollTop;
              element.scrollTop -= Math.max(1, element.clientHeight / 2);
              return before !== element.scrollTop;
            });
            if (!moved) break;
          }
          expect([...history].sort()).toEqual(
            Array.from({ length: 120 }, (_, index) => `Benchmark session ${String(index + 1).padStart(4, "0")}`),
          );
        } finally {
          await ticketViewport.evaluate((element) => {
            element.scrollTop = 0;
          });
        }
        await page.goBack();
        await expect(sidenav.getByRole("option", { name: "Sessions", exact: true })).toBeVisible();
        await network.settled(performance.now());
        const sessions = await measureSubnav(
          page,
          network,
          sidenav.getByRole("option", { name: "Sessions", exact: true }),
          "sessions",
          visit,
          "",
        );
        samples.push(sessions);
        console.info(JSON.stringify({ iteration: iteration + 1, ...sessions }));
        // The extracted Sessions tree pages its children. Keep all 1,000 sessions
        // reachable after measurement without changing the timed navigation interval.
        const oldest = sidenav.getByRole("option", { name: "Benchmark session 0001", exact: true });
        for (let offset = 50; offset < SUBNAV_WORKLOAD.sessions; offset += 50) {
          // The tree loads its next bounded page when scrolling reaches the boundary.
          // Check each page's final row outside the measured navigation interval.
          const number = Math.max(1, SUBNAV_WORKLOAD.sessions - offset - 49);
          const row = sidenav.getByRole("option", {
            name: `Benchmark session ${String(number).padStart(4, "0")}`,
            exact: true,
          });
          await expect.poll(() => revealTreeEntry(page, sidenav, row, { fromCurrentPosition: true })).toBe(true);
        }
        await expect(oldest).toBeVisible();
        await page.goBack();
      }
      if (iteration === 0 && process.env.SUBNAV_TRACE === "1")
        await context.tracing.stop({ path: join(output, "first-visits.zip") });
    } catch (error) {
      await Promise.allSettled([
        page.screenshot({ path: join(output, "failure.png") }),
        page
          .evaluate(() => ({
            url: location.href,
            clock: window.__subnavBenchmark,
            fetchSignals: window.__subnavFetchSignals,
            regions: [...document.querySelectorAll("[data-workbench-region]")].map((element) =>
              element.getAttribute("data-workbench-region"),
            ),
            editors: [...document.querySelectorAll("[contenteditable]")].map((element) => ({
              editable: element.getAttribute("contenteditable"),
              text: element.textContent?.slice(0, 300),
              region: element.closest("[data-workbench-region]")?.getAttribute("data-workbench-region"),
            })),
            text: document.body.innerText.slice(0, 3000),
          }))
          .then((state) => Bun.write(join(output, "failure-state.json"), JSON.stringify(state, null, 2))),
      ]);
      throw error;
    } finally {
      await context.close();
    }
  }
  const summarize = (values: number[]) => {
    if (values.length === 0) return { n: 0, median: null, p95: null, max: null };
    const sorted = values.toSorted((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return {
      n: sorted.length,
      median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1]! + sorted[middle]!) / 2,
      p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
      max: sorted.at(-1),
    };
  };
  const summary = ["sessions", "ticket"].flatMap((destination) =>
    ["first", "repeat"].map((visit) => {
      const rows = samples.filter((sample) => sample.destination === destination && sample.visit === visit);
      return {
        destination,
        visit,
        structure: summarize(rows.map((row) => row.structureMs)),
        data: summarize(rows.map((row) => row.dataMs)),
        ...(destination === "ticket"
          ? { editor: summarize(rows.flatMap((row) => (row.editorMs === undefined ? [] : [row.editorMs]))) }
          : {}),
        requestsComplete: summarize(rows.map((row) => row.lastRequestMs)),
        requestDuration: summarize(rows.flatMap((row) => row.requests.map((request) => request.durationMs))),
        structureMisses: rows.filter((row) => !isBelowBudget(row.structureMs, SUBNAV_BUDGETS.structureMs)).length,
        dataMisses: rows.filter((row) => !isBelowBudget(row.dataMs, SUBNAV_BUDGETS.dataMs)).length,
        editorMisses: rows.filter(
          (row) => row.editorMs !== undefined && !isBelowBudget(row.editorMs, SUBNAV_BUDGETS.editorMs),
        ).length,
      };
    }),
  );
  for (const sample of samples) {
    const name = `${sample.destination}-${sample.visit}`;
    const place = `${sample.destination === "ticket" ? "a ticket" : "sessions"}, ${sample.visit} visit`;
    const record = (part: keyof typeof SUBNAV_BUDGETS, what: string, value: number | undefined) => {
      if (value === undefined) return;
      const budget = SUBNAV_BUDGETS[part];
      recordMeasurement({ metric: `${name}/${part}`, label: `Open ${place}, ${what}`, unit: "ms", value, budget });
    };
    record("structureMs", "sections", sample.structureMs);
    record("dataMs", "data", sample.dataMs);
    record("editorMs", "editor", sample.editorMs);
  }
  const report = {
    label,
    measuredAt: new Date().toISOString(),
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    binarySha256: new Bun.CryptoHasher("sha256")
      .update(await Bun.file(PACKAGED_BINARY_PATH).arrayBuffer())
      .digest("hex"),
    plannerSource: process.env.SUBNAV_PLANNER_SOURCE ?? "current workspace build",
    budgets: SUBNAV_BUDGETS,
    workload: fixture.workload,
    browser: browser.version(),
    viewport: "1440x900",
    platform: `${process.platform}/${process.arch}`,
    cpu: cpus()[0]?.model,
    availableCpus: cpus().length,
    memoryGiB: totalmem() / 1024 ** 3,
    cpuThrottle: 1,
    tracing: process.env.SUBNAV_TRACE === "1",
    injectedDelays: false,
    measurement:
      "Trusted click to visible destination sections and editable ticket content after two animation frames; complete data includes the last sidenav DOM update after two frames and all subnav requests",
    samples,
    summary,
    errors,
  };
  for (const sample of samples) {
    const classified = classifySubnavRequests(sample.requests);
    sample.requests = classified.requests;
  }
  const budgetResult = subnavBenchmarkResults(samples, sampleCount);
  const browserErrors = errors.map((message) => ({ message }));
  errors.push(...budgetResult.requestErrors, ...budgetResult.budgetErrors);
  await Bun.write(join(output, "results.json"), JSON.stringify(report, null, 2));
  executionReport = { suites: [{ specs: budgetResult.specs }], errors: browserErrors };
  console.info(JSON.stringify({ label, summary, errors }, null, 2));
  if (errors.length || summary.some((row) => row.structureMisses || row.dataMisses || row.editorMisses))
    process.exitCode = 1;
} catch (error) {
  const status = () => ({ pid: fixture.child.pid, exitCode: fixture.child.exitCode, signal: fixture.child.signalCode });
  const before = status();
  // Inspect the already-failed setup without retrying login or changing its verdict.
  const ready = await fetch(`${fixture.baseUrl}/runtime/ready`, {
    headers: { ...runtimeAuthorization(fixture.descriptor), connection: "close" },
    signal: AbortSignal.timeout(1000),
  })
    .then(async (response) => ({ status: response.status, body: await response.text() }))
    .catch((reason) => ({ error: String(reason) }));
  const saved = await Promise.allSettled([
    Bun.write(
      join(output, "partial-results.json"),
      JSON.stringify({ complete: false, expected: sampleCount * 4, samples, errors, error: String(error) }, null, 2),
    ),
    Bun.write(
      join(output, "runtime-failure.json"),
      JSON.stringify(
        {
          observedAt: new Date().toISOString(),
          runtimeCleanupStarted: false,
          before,
          ready,
          after: status(),
          error: String(error),
        },
        null,
        2,
      ),
    ),
  ]);
  for (const result of saved)
    if (result.status === "rejected") console.error("Could not retain benchmark diagnostics", result.reason);
  throw error;
} finally {
  try {
    await browser?.close();
  } finally {
    try {
      await fixture.stop();
    } finally {
      const log = join(subnavFixtureRoot, "runtime.log");
      if (existsSync(log)) copyFileSync(log, join(output, "runtime.log"));
    }
  }
}
// Publish execution evidence only after browser and runtime cleanup both complete.
if (!executionReport) throw new Error("Incomplete navigation benchmark execution");
await Bun.write(
  resolve(import.meta.dir, "../../test-results/subnav-benchmarks.json"),
  JSON.stringify({
    config: {
      rootDir: resolve(import.meta.dir, "../.."),
      metadata: { quarantineAttempt: process.env.CI_QUARANTINE_ATTEMPT },
    },
    ...executionReport,
  }),
);
