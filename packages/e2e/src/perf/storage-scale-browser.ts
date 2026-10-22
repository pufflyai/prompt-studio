import { contract, type Profile, pageRows, workload } from "storage-scale-fixture";
import { openScaleBrowser } from "./storage-scale-browser-session";
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
  temperature: string,
) => {
  // Expected data is generated before any application navigation or sample timer.
  const owner = fixture.kind === "small" ? 0 : 9;
  const expected = pageRows(workload(fixture.kind), owner, "focus", 0);
  const { browser, page, replies, diagnostics } = await openScaleBrowser(profile);
  try {
    const login = await runtime.request<{ url: string }>("/runtime/browser-login", "POST");
    const url = new URL(login.url);
    url.host = new URL(runtime.baseUrl).host;
    const queryPath = owner === 9 ? ".view.tickets.kanban.query" : `.view.records-${mode}.kanban.query`;
    url.pathname =
      owner === 9
        ? `/projects/${fixture.projectId}/extensions/pstdio.pstdio-planner/tickets`
        : `/projects/${fixture.projectId}/extensions/scale.scale-owner-0/records-${mode}`;
    if (page.url() !== "about:blank") throw new Error("Cold sample preloaded a page");
    if (temperature === "warm") {
      await page.goto(url.href, { waitUntil: "commit" });
      await page.getByText(expected[0].title, { exact: true }).first().waitFor();
      replies.length = 0;
    }
    const start = performance.now();
    if (temperature === "cold") await page.goto(url.href, { waitUntil: "commit" });
    else await page.reload({ waitUntil: "commit" });
    // Virtualized rows need not all mount. This baseline deliberately refuses to infer that
    // all requested rows are ready from a first card. Missing page support remains a failure.
    await page.getByText(expected[0].title, { exact: true }).first().waitFor();
    const firstVisibleMs = performance.now() - start;
    await page
      .getByRole("button", { name: /Filter/ })
      .first()
      .waitFor();
    const dataReadyMs = performance.now() - start;
    const details = await diagnostics();
    const query = replies.findLast((reply) => reply.path.includes(queryPath));
    const selected = owner === 9 ? query?.rows.filter((row) => row.attributes?.status === "ready") : query?.rows;
    const dataCorrect =
      JSON.stringify(selected?.map(({ id, title }) => ({ id, title }))) ===
      JSON.stringify(expected.map(({ id, title }) => ({ id, title })));
    const body = await page.locator("body").innerText();
    const labelsCorrect = !/Unavailable field|\bdefault-ready\b|\bdefault-backlog\b/.test(body);
    const renderedTitles = expected.filter((row) => body.includes(row.title)).map((row) => row.id);
    const controls = await page.getByRole("button", { name: /Filter/ }).count();
    const screenshot = await page.screenshot({ fullPage: false });
    return {
      mode,
      owner,
      ...details,
      startupMs: runtime.startupMs,
      firstVisibleMs,
      dataReadyMs,
      dataCorrect,
      returnedRows: query?.rows.length ?? null,
      allRowsReadyMs: null,
      requested: expected.map((row) => row.id),
      renderedTitles,
      labelsCorrect,
      controls,
      screenshot,
      passed: false,
      failures: [
        ...(!dataCorrect ? ["incorrect-requested-data"] : []),
        ...(dataReadyMs >= contract.ceilingMs ? ["latency"] : []),
        ...(query && query.rows.length > 100 ? ["hidden-full-load"] : []),
        "virtualized-row-readiness-unproved",
        "runtime-hydration-uninstrumented",
      ],
    };
  } finally {
    await browser.close();
  }
};
