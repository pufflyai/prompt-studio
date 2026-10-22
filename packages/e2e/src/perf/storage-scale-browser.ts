import { chromium } from "@playwright/test";
import { contract, type Profile, pageRows, workload } from "storage-scale-fixture";
import type { ScaleRuntime } from "./storage-scale-runtime";

interface Fixture {
  projectId: string;
  kind: "rich" | "small";
  churn: boolean;
}

export const measureScaleNavigation = async (
  runtime: ScaleRuntime,
  fixture: Fixture,
  profile: Profile,
  mode: "board" | "list",
) => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: contract.profiles[profile].rendererRate });
    await cdp.send("Performance.enable");
    const targets = await (await browser.newBrowserCDPSession()).send("Target.getTargets");
    const responses: { path: string; bytes: number }[] = [];
    const pending: Promise<void>[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/v1/"))
        pending.push(
          response
            .body()
            .then((body) => {
              responses.push({ path: new URL(response.url()).pathname, bytes: body.byteLength });
            })
            .catch(() => {}),
        );
    });
    await page.addInitScript(() => {
      if (window.top === window) localStorage.setItem("onboarding-complete", "true");
    });
    const login = await runtime.request<{ url: string }>("/runtime/browser-login", "POST");
    const url = new URL(login.url);
    url.pathname = `/projects/${fixture.projectId}/extensions/pstdio.pstdio-planner/tickets`;
    if (page.url() !== "about:blank") throw new Error("Cold sample preloaded a page");
    const start = performance.now();
    await page.goto(url.href, { waitUntil: "commit" });
    // Virtualized rows need not all mount. This baseline deliberately refuses to infer that
    // all requested rows are ready from a first card. Missing page support remains a failure.
    await page.locator('[data-testid="renderer-card"], [data-testid="row-status-icon"]').first().waitFor();
    const firstVisibleMs = performance.now() - start;
    const expected = pageRows(workload(fixture.kind), 9, "focus", 0);
    const body = await page.locator("body").innerText();
    const labelsCorrect = !/Unavailable field|\bdefault-ready\b|\bdefault-backlog\b/.test(body);
    const renderedTitles = expected.filter((row) => body.includes(row.title)).map((row) => row.id);
    const controls = await page.getByRole("button", { name: /Filter/ }).count();
    const metrics = await cdp.send("Performance.getMetrics");
    const screenshot = await page.screenshot({ fullPage: false });
    await Promise.all(pending);
    return {
      mode,
      browser: browser.version(),
      startupMs: runtime.startupMs,
      firstVisibleMs,
      allRowsReadyMs: null,
      requested: expected.map((row) => row.id),
      renderedTitles,
      labelsCorrect,
      controls,
      responses,
      metrics: metrics.metrics,
      screenshot,
      renderer: {
        rate: contract.profiles[profile].rendererRate,
        appliedBeforeNavigation: true,
        targets: targets.targetInfos.map(({ type, url }) => ({ type, url })),
        workerIframeCoverage: "unverified",
        calibration: null,
      },
      passed: false,
      failures: ["bounded-page-readiness-unproved", "runtime-hydration-uninstrumented"],
    };
  } finally {
    await browser.close();
  }
};
