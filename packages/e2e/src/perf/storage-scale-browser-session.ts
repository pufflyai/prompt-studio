import { chromium } from "@playwright/test";
import { contract, type Profile } from "storage-scale-fixture";
import { PACKAGED_TEST_TIMEOUT } from "../packaged/packaged-test-timeout";

export interface QueryReply {
  path: string;
  bytes: number;
  finishedAt: number;
  rows: { id: string; title?: string; attributes?: Record<string, unknown> }[];
}

export const openScaleBrowser = async (profile: Profile) => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.setDefaultTimeout(PACKAGED_TEST_TIMEOUT);
  page.setDefaultNavigationTimeout(PACKAGED_TEST_TIMEOUT);
  const cdp = await page.context().newCDPSession(page);
  const calibrate = () =>
    page.evaluate(() => {
      const started = performance.now();
      let checksum = 42;
      for (let index = 0; index < 5_000_000; index++) checksum = (Math.imul(checksum, 1664525) + 1013904223) >>> 0;
      return { durationMs: performance.now() - started, checksum };
    });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const nativeCalibration: Awaited<ReturnType<typeof calibrate>>[] = [];
  for (let index = 0; index < 3; index++) nativeCalibration.push(await calibrate());
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: contract.profiles[profile].rendererRate });
  const constrainedCalibration: Awaited<ReturnType<typeof calibrate>>[] = [];
  for (let index = 0; index < 3; index++) constrainedCalibration.push(await calibrate());
  await cdp.send("Performance.enable");
  const replies: QueryReply[] = [];
  const responses: { path: string; bytes: number }[] = [];
  const pending: Promise<void>[] = [];
  page.on("response", (response) => {
    if (!response.url().includes("/v1/")) return;
    // Event streams never finish. Waiting for their bodies would hang diagnostics after
    // the foreground timer, and would hide both success and failure of the view.
    if (!response.headers()["content-type"]?.includes("application/json")) return;
    pending.push(
      response
        .body()
        .then((body) => {
          const path = new URL(response.url()).pathname;
          responses.push({ path, bytes: body.byteLength });
          if (!path.includes(".kanban.query")) return;
          const result = JSON.parse(body.toString());
          if (Array.isArray(result.outcome?.value?.rows))
            replies.push({
              path,
              bytes: body.byteLength,
              finishedAt: performance.now(),
              rows: result.outcome.value.rows,
            });
        })
        .catch(() => {}),
    );
  });
  await page.addInitScript(() => {
    if (window.top === window) localStorage.setItem("onboarding-complete", "true");
  });
  const diagnostics = async () => {
    await Promise.all(pending);
    const targets = await (await browser.newBrowserCDPSession()).send("Target.getTargets");
    const frames = page.frames().map((frame) => ({ url: frame.url(), main: frame === page.mainFrame() }));
    const unsupported = targets.targetInfos.filter(
      (target) => target.type === "worker" || target.type === "iframe" || target.type === "service_worker",
    );
    return {
      browser: browser.version(),
      responseCaptureScope: "completed /v1 JSON responses; excludes streams and assets",
      responses,
      metrics: (await cdp.send("Performance.getMetrics")).metrics,
      renderer: {
        rate: contract.profiles[profile].rendererRate,
        appliedBeforeNavigation: true,
        targets: targets.targetInfos.map(({ type, url }) => ({ type, url })),
        frames,
        workerIframeCoverage:
          unsupported.length === 0 && frames.length === 1
            ? "all-relevant-targets-covered"
            : "unsupported-targets-present",
        calibration: { iterations: 5_000_000, native: nativeCalibration, applied: constrainedCalibration },
      },
    };
  };
  return { browser, page, replies, diagnostics };
};
