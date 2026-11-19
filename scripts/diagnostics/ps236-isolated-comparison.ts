// Temporary PS-236 browser/API acceptance, outside the frozen benchmark catalog.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { archiveColumn, moveLateTicket, moveVisiblePair } from "./ps236-comparison-mutations";
import {
  browserTools,
  evidence,
  execute,
  ids,
  measure,
  output,
  planner,
  project,
  request,
  save,
  uiOrigin,
  variant,
} from "./ps236-comparison-setup";

const { chromium } = createRequire(join(resolve(browserTools!), "package.json"))("@playwright/test");
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  recordVideo: { dir: join(output, "videos") },
});
const page = await context.newPage();
await context.tracing.start({ screenshots: true, snapshots: true });
page.setDefaultTimeout(30_000);
await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
const browserErrors: string[] = [];
page.on("pageerror", (error: Error) => browserErrors.push(error.message));
const responses: unknown[] = [];
page.on("response", async (response: any) => {
  if (!response.url().includes("/commands/")) return;
  try {
    const result = await response.json(),
      value = result.outcome?.value;
    responses.push({
      path: new URL(response.url()).pathname,
      status: response.status(),
      rows: value?.rows?.length ?? value?.ticketRows?.length,
      total: value?.page?.total,
      error: result.outcome?.status === "error" ? result.outcome.error : undefined,
      bytes: JSON.stringify(result).length,
    });
  } catch {}
});
const failure = (name: string, error: unknown) => {
  (evidence.errors as unknown[]).push({ name, error: String(error) });
  save();
};
const attempt = async (name: string, run: () => Promise<void>) => {
  try {
    await run();
  } catch (error) {
    failure(name, error);
  }
};
const boardCommand = "pstdio.planner.view.tickets.kanban.query";
const foobarCommand = "pstdio.ps236-demo-foobar.view.foobars.kanban.query";
const pageRequest = (offset = 0) => ({ limit: 50, offset, search: "", fields: ["title", "id", "status"] });
const boardParams = {
  settings: { viewMode: "board", columnGrouping: "status", rowGrouping: "none" },
  sorts: [{ attributeId: "created", direction: "desc" }],
};
const boardUrl = `${uiOrigin}/projects/${project.id}/extensions/pstdio.planner/tickets`;
const search = async (needle: string, command = boardCommand) => {
  const box = page.getByRole("textbox", { name: "Search this view" });
  if (!(await box.isVisible())) await page.getByRole("button", { name: "Search this view" }).click();
  const queried =
    variant === "candidate" || command === foobarCommand
      ? page.waitForResponse((reply: any) => {
          if (!reply.url().endsWith(`${command}/execute`)) return false;
          return reply.request().postDataJSON()?.params?.page?.search === needle;
        })
      : undefined;
  await box.fill(needle);
  await queried;
};
try {
  const login = await request("/runtime/browser-login", {});
  const redeemed = page.waitForResponse((reply: any) => new URL(reply.url()).pathname === "/runtime/browser-session");
  const ready = page.waitForResponse((reply: any) => new URL(reply.url()).pathname === "/runtime/ready");
  await page.goto(login.url, { waitUntil: "domcontentloaded" });
  assert.ok((await redeemed).ok());
  assert.ok((await ready).ok());
  for (const trial of ["cold", "repeated"])
    await attempt(`board-${trial}`, async () => {
      await measure(`board-browser-${trial}`, async () => {
        await page.goto(boardUrl, { waitUntil: "commit" });
        await page.getByTestId("renderer-card").filter({ hasText: "Scale ticket" }).first().waitFor();
      });
      await page.screenshot({ path: join(output, `board-${trial}.png`), fullPage: true });
    });
  await attempt("board-browser-search-page", async () => {
    await measure("board-browser-late-search", async () => {
      await search("Scale ticket 04999");
      await page.getByTestId("renderer-card").filter({ hasText: "Scale ticket 04999" }).waitFor();
    });
    await page.screenshot({ path: join(output, "board-late-search.png"), fullPage: true });
    await search("Scale ticket");
    if (variant === "main") {
      evidence.baselineBrowserPaging =
        "Legacy browser locally filters and scrolls its full result; no continuation supplied.";
      return;
    }
    const continuation = page.waitForResponse(
      (reply: any) =>
        reply.url().endsWith(`${boardCommand}/execute`) && reply.request().postDataJSON()?.params?.page?.offset > 0,
    );
    await measure("board-browser-continuation", async () => {
      await page.getByRole("button", { name: "Load more cards" }).first().click();
      const reply = await continuation;
      assert.ok(reply.ok());
    });
    await page.screenshot({ path: join(output, "board-continuation.png"), fullPage: true });
  });
  await attempt("board-pages", async () => {
    const first = await measure("board-first-page", () =>
      execute(boardCommand, { ...boardParams, page: pageRequest() }),
    );
    if (!first.page) {
      evidence.board = { mode: "full-result", returned: first.rows.length };
      assert.equal(first.rows.length, 5000);
      return;
    }
    assert.equal(first.page.total, 5000);
    assert.equal(first.rows.length, 50);
    assert.equal(
      first.page.groups.reduce((n: number, g: any) => n + g.count, 0),
      5000,
    );
    const next = await measure("board-second-page", () =>
      execute(boardCommand, {
        ...boardParams,
        page: { ...pageRequest(50), cursor: first.page.cursor, revision: first.page.revision },
      }),
    );
    assert.equal(next.rows.length, 50);
    const seen = new Set(first.rows.map((r: any) => r.id));
    assert.ok(next.rows.every((r: any) => !seen.has(r.id)));
    evidence.board = { first: first.page, second: next.page };
  });
  await attempt("late-filter-sort", async () => {
    const filtered = await measure("board-late-search", () =>
      execute(boardCommand, { ...boardParams, page: { ...pageRequest(), search: "Scale ticket 04999" } }),
    );
    if (!filtered.page) {
      evidence.baselineServerSearch = { mode: "client-filtered-full-result", returned: filtered.rows.length };
      return;
    }
    assert.equal(filtered.rows.length, 1);
    assert.ok(filtered.rows[0].title.includes("04999"));
    const statuses = await measure("board-global-filter", () =>
      execute(boardCommand, {
        ...boardParams,
        page: pageRequest(),
        filter: {
          conjunction: "and",
          rules: [{ attributeId: "status", condition: "is-any-of", value: ["in-progress"] }],
        },
      }),
    );
    assert.equal(statuses.page.total, 1666);
    assert.equal(statuses.rows.length, 50);
  });
  await attempt("late-ticket-open", async () => {
    await measure("late-ticket-browser-open", async () => {
      await page.goto(boardUrl, { waitUntil: "commit" });
      await search("Scale ticket 04999");
      await page.getByTestId("renderer-card").filter({ hasText: "Scale ticket 04999" }).click();
      await page.locator('[contenteditable="true"]').filter({ hasText: "Scale ticket 04999" }).first().waitFor();
    });
    await page.screenshot({ path: join(output, "late-ticket.png"), fullPage: true });
  });
  await attempt("timeline-browser", async () => {
    await measure("timeline-browser", async () => {
      await page.goto(`${uiOrigin}/projects/${project.id}/extensions/pstdio.planner/ticket-timeline`, {
        waitUntil: "commit",
      });
      await page
        .frameLocator('iframe[title="Project Timeline"]')
        .getByText("Scale ticket", { exact: false })
        .first()
        .waitFor();
    });
    await page.screenshot({ path: join(output, "timeline.png"), fullPage: true });
  });
  await attempt("timeline-browser-move", () => moveVisiblePair(page));
  await attempt("timeline-pages", async () => {
    const first = await measure("timeline-first-page", () => planner("timeline.plan.read", { page: pageRequest() }));
    if (!first.page) {
      evidence.timeline = {
        mode: "full-result",
        returned: first.sections.reduce((n: number, s: any) => n + s.rows.length, 0),
      };
      return;
    }
    const next = await measure("timeline-second-page", () =>
      planner("timeline.plan.read", {
        page: { ...pageRequest(50), cursor: first.page.cursor, revision: first.page.revision },
      }),
    );
    assert.equal(first.page.total, 5000);
    assert.equal(first.ticketRows.length, 50);
    assert.equal(next.ticketRows.length, 50);
    evidence.timeline = { first: first.page, next: next.page };
  });
  await attempt("timeline-move-unloaded", moveLateTicket);
  await attempt("foobar-defaults", async () => {
    await measure("foobar-browser", async () => {
      await page.goto(`${uiOrigin}/projects/${project.id}/extensions/pstdio.ps236-demo-foobar/foobars`, {
        waitUntil: "commit",
      });
      await page.getByTestId("renderer-card").filter({ hasText: "Foobar" }).first().waitFor();
    });
    await page.screenshot({ path: join(output, "foobars.png"), fullPage: true });
    await measure("foobar-browser-late-search", async () => {
      await search("Foobar 0499", foobarCommand);
      await page.getByTestId("renderer-card").filter({ hasText: "Foobar 04999" }).waitFor();
    });
    await page.getByRole("button", { name: "Display settings" }).click();
    await page.getByRole("button", { name: "Ordering", exact: true }).click();
    await page.getByRole("menuitem", { name: "Title", exact: true }).click();
    await page.getByRole("button", { name: "Sort direction", exact: true }).click();
    const sorted = page.waitForResponse(
      (reply: any) =>
        reply.url().endsWith(`${foobarCommand}/execute`) &&
        reply.request().postDataJSON()?.params?.sorts?.[0]?.direction === "desc",
    );
    await page.getByRole("menuitem", { name: /Z.*A|Descending/ }).click();
    assert.ok((await sorted).ok());
    await page.getByRole("button", { name: "Display settings" }).click();
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="renderer-card"]')?.textContent?.includes("Foobar 04999"),
    );
    await page.screenshot({ path: join(output, "foobars-filtered-sorted.png"), fullPage: true });
    await page.screenshot({ path: join(output, "foobars-filtered-sorted.png"), fullPage: true });
    const first = await measure("foobar-default-page", () => execute(foobarCommand));
    assert.equal(first.rows.length, 100);
    assert.equal(first.page.total, 5000);
    assert.ok(!JSON.stringify(first).includes("Foobar body."));
    const filtered = await measure("foobar-late-filter", () =>
      execute(foobarCommand, {
        filter: { conjunction: "and", rules: [{ attributeId: "state", condition: "is-any-of", value: ["late"] }] },
        sorts: [{ attributeId: "title", direction: "desc" }],
      }),
    );
    assert.equal(filtered.rows.length, 10);
    assert.equal(filtered.page.total, 10);
    assert.equal(filtered.rows[0].title, "Foobar 04999");
    evidence.foobar = { first: first.page, filtered: filtered.page };
  });
  await attempt("bulk-archive-unloaded", () => archiveColumn(page, boardUrl));
} finally {
  evidence.browserErrors = browserErrors;
  writeFileSync(join(output, "browser-command-responses.json"), JSON.stringify(responses, null, 2));
  await context.tracing.stop({ path: join(output, "walkthrough.zip") });
  await context.close();
  await browser.close();
  save();
}
if ((evidence.errors as unknown[]).length) process.exitCode = 1;
