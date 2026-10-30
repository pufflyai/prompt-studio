import { expect, test } from "@playwright/test";
import { recordMeasurement } from "pstdio-benchmarks/writer";

for (const [workload, query, count] of [
  ["button", "preview=ui-components-inputs-button--variants", 1],
  ["documentation", "canvas=documentation-contract", 1],
  ["populated", "canvas=verification-populated", 24],
] as const) {
  // Critical: cold startup must reach usable previews without changing the fixed 24-frame workload.
  test(`cold frame startup: ${workload}`, async ({ page }, info) => {
    const started = performance.now();
    await page.goto(`/?${query}`);
    const shell = page.frameLocator("[data-verification-host]");
    await expect(shell.locator('iframe[data-frame-ready="true"]').first()).toBeVisible();
    const firstReadyMs = performance.now() - started;
    await expect(shell.locator('iframe[data-frame-ready="true"]')).toHaveCount(count);
    const allReadyMs = performance.now() - started;
    const frames = await shell.locator('iframe[data-frame-ready="true"]').evaluateAll((elements) =>
      elements.map((element) => ({
        modules: Number(element.getAttribute("data-frame-modules") ?? "0"),
        bytes: Number(element.getAttribute("data-frame-bytes") ?? "0"),
        timings: JSON.parse(element.getAttribute("data-frame-timings") ?? "{}"),
      })),
    );
    const record = { workload, repeat: info.repeatEachIndex, firstReadyMs, allReadyMs, frames };
    console.log(JSON.stringify(record));
    recordMeasurement({
      metric: `${workload}/first-ready`,
      label: `${workload}, first ready`,
      unit: "ms",
      value: firstReadyMs,
    });
    recordMeasurement({
      metric: `${workload}/all-ready`,
      label: `${workload}, all ready`,
      unit: "ms",
      value: allReadyMs,
    });
    await info.attach("frame-startup", { body: JSON.stringify(record, null, 2), contentType: "application/json" });
  });
}
