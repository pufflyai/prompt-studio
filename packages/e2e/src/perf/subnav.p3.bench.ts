import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { cpus, totalmem } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, expect } from "@playwright/test";
import { PROVISIONED_CHROMIUM } from "../packaged/packaged-chromium";
import { PACKAGED_BINARY_PATH } from "../packaged/packaged-helpers";
import { signInBrowser } from "../packaged/packaged-serve-helpers";
import {
  createSubnavNetworkRecorder,
  installSubnavClock,
  measureSubnav,
  type SubnavSample,
} from "./subnav-benchmark-clock";
import { startSubnavBenchmarkFixture, subnavFixtureRoot } from "./subnav-benchmark-fixture";

// Set on 2026-10-26 from four hosted ubuntu-24.04 runs (slowest 293 / 1,263 / 1,089 ms) plus about 20%.
export const SUBNAV_BUDGETS = { structureMs: 375, dataMs: 1_525, editorMs: 1_325 };
const sampleCount = Number(process.env.SUBNAV_SAMPLES ?? 30);
const label = process.env.SUBNAV_LABEL ?? "current";
if (!Number.isInteger(sampleCount) || sampleCount < 1) throw new Error("SUBNAV_SAMPLES must be a positive integer");
const fixture = await startSubnavBenchmarkFixture();
let browser: Browser | undefined;
const samples: SubnavSample[] = [];
const errors: string[] = [];
const output = join(subnavFixtureRoot, "results", label);
try {
  await mkdir(output, { recursive: true });
  browser = await chromium.launch(PROVISIONED_CHROMIUM);
  for (let iteration = 0; iteration < sampleCount; iteration++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    try {
      page.on("pageerror", (error) => errors.push(error.message));
      await installSubnavClock(page);
      await page.addInitScript((projectId) => {
        localStorage.setItem("onboarding-complete", "true");
        localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
      }, fixture.project.id);
      const network = createSubnavNetworkRecorder(page);
      if (iteration === 0 && process.env.SUBNAV_TRACE === "1")
        await context.tracing.start({ screenshots: true, snapshots: true });
      await signInBrowser(page, fixture.descriptor);
      const startUrl = `${fixture.baseUrl}/projects/${fixture.project.id}/extensions/pstdio.pstdio-planner/tickets`;
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
        if (!ticket.requests.some((request) => request.sessionRows === 120))
          errors.push(`Iteration ${iteration + 1} ${visit}: ticket history did not contain all 120 sessions`);
        if (iteration === 0 && visit === "first") await page.screenshot({ path: join(output, "ticket.png") });
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
        // Verify the full list remains reachable after the timed interval, despite virtualization.
        await sidenav
          .getByRole("option", { name: /^Benchmark session/ })
          .first()
          .focus();
        await page.keyboard.press("End");
        await expect(sidenav.getByRole("option", { name: "Benchmark session 0001", exact: true })).toBeVisible();
        await page.goBack();
      }
      if (iteration === 0 && process.env.SUBNAV_TRACE === "1")
        await context.tracing.stop({ path: join(output, "first-visits.zip") });
    } catch (error) {
      await page.screenshot({ path: join(output, "failure.png") });
      await Bun.write(
        join(output, "failure-state.json"),
        JSON.stringify(
          await page.evaluate(() => ({
            url: location.href,
            clock: window.__subnavBenchmark,
            regions: [...document.querySelectorAll("[data-workbench-region]")].map((element) =>
              element.getAttribute("data-workbench-region"),
            ),
            editors: [...document.querySelectorAll("[contenteditable]")].map((element) => ({
              editable: element.getAttribute("contenteditable"),
              text: element.textContent?.slice(0, 300),
              region: element.closest("[data-workbench-region]")?.getAttribute("data-workbench-region"),
            })),
            text: document.body.innerText.slice(0, 3000),
          })),
          null,
          2,
        ),
      );
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
        structureMisses: rows.filter((row) => row.structureMs >= SUBNAV_BUDGETS.structureMs).length,
        dataMisses: rows.filter((row) => row.dataMs > SUBNAV_BUDGETS.dataMs).length,
        editorMisses: rows.filter((row) => row.editorMs !== undefined && row.editorMs >= SUBNAV_BUDGETS.editorMs)
          .length,
      };
    }),
  );
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
  errors.push(
    ...samples.flatMap((sample) =>
      sample.requests
        .filter((request) => request.failure || !request.status || request.status >= 400 || request.outcomeOk === false)
        .map((request) => `${sample.destination}/${sample.visit}: ${JSON.stringify(request)}`),
    ),
  );
  await Bun.write(join(output, "results.json"), JSON.stringify(report, null, 2));
  console.info(JSON.stringify({ label, summary, errors }, null, 2));
  if (errors.length || summary.some((row) => row.structureMisses || row.dataMisses || row.editorMisses))
    process.exitCode = 1;
} finally {
  try {
    await browser?.close();
  } finally {
    await fixture.stop();
  }
}
