import { strict as assert } from "node:assert";
import { contract, type Profile, pageRows, workload } from "storage-scale-fixture";
import { openScaleBrowser } from "./storage-scale-browser-session";
import type { ScaleFixture, ScaleRuntime } from "./storage-scale-runtime";

export const measureScalePage = async (
  runtime: ScaleRuntime,
  fixture: ScaleFixture,
  profile: Profile,
  temperature: string,
) => {
  const expected = pageRows(workload(fixture.kind), 0, "pages", 1);
  const first = pageRows(workload(fixture.kind), 0, "pages", 0);
  const { browser, page, diagnostics } = await openScaleBrowser(profile);
  try {
    const login = await runtime.request<{ url: string }>("/runtime/browser-login", "POST");
    const url = new URL(login.url);
    url.host = new URL(runtime.baseUrl).host;
    url.pathname = `/projects/${fixture.projectId}/extensions/scale.scale-owner-0/records-table`;
    let start = performance.now();
    await page.goto(url.href, { waitUntil: "commit" });
    await page.getByText(first[0].title, { exact: true }).first().waitFor();
    const firstPageMs = performance.now() - start;
    if (temperature === "warm") start = performance.now();
    await page.getByRole("button", { name: "Go to next page", exact: true }).click();
    await page.getByText(expected[0].title, { exact: true }).first().waitFor();
    const durationMs = performance.now() - start;
    assert.equal(await page.getByText(first[0].title, { exact: true }).count(), 0);
    const screenshot = await page.screenshot();
    return {
      durationMs,
      firstPageMs,
      firstRowCorrect: true,
      requested: expected.map((row) => row.id),
      boundary:
        temperature === "cold"
          ? "first navigation through second-page visible row"
          : "next-page action through visible row",
      ...(await diagnostics()),
      screenshot,
      passed: false,
      failures: [
        ...(durationMs >= contract.ceilingMs ? ["latency"] : []),
        "legacy-client-paging-hydrates-owner",
        "all-page-row-readiness-unproved",
      ],
    };
  } finally {
    await browser.close();
  }
};
