import { strict as assert } from "node:assert";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, request } from "@playwright/test";
import { summarizeSamples, waitForTicketsView } from "./perf-helpers";
import { installPlannerClock, measurePlannerDrop, recordPlannerRequests } from "./planner-moves-browser";
import { configureStressViews, executePlanner, type StressTicket, seedStressTickets } from "./planner-stress-fixture";

// Connect only to the disposable Docker stack created by `bun run dev:playwright`.
// No server, production project, or database is opened by this diagnostic.
const repo = resolve(import.meta.dirname, "../../../..");
const connection = JSON.parse(
  await readFile(resolve(repo, "__test-tmp__/dev-isolated/pstdio-playwright/connection.json"), "utf8"),
);
const output = resolve(repo, "__test-tmp__/planner-stress", String(Date.now()));
await mkdir(output, { recursive: true });
const api = await request.newContext({
  baseURL: `http://127.0.0.1:${connection.apiPort}`,
  extraHTTPHeaders: { authorization: `Bearer ${connection.apiToken}` },
});
const projects = await (await api.get("/v1/projects")).json();
const project = projects.find((item: { name: string }) => item.name === "project");
assert(project, "The isolated demo project must exist");
const browser = await chromium.launch();
console.info(`Browser: ${browser.version()}; CPU throttle: ${process.env.CPU_THROTTLE ?? "4"}`);
const tickets: StressTicket[] = [];
const results: unknown[] = [];
const backend: unknown[] = [];
const cpuRate = Number(process.env.CPU_THROTTLE ?? "4");
const cases = [
  { count: 50, views: 1 },
  { count: 500, views: 1 },
  { count: 500, views: 15 },
  { count: 1_000, views: 15 },
];

try {
  await waitForTicketsView(api, project.id);
  const initial = await executePlanner<{ rows: Array<{ id: string; title: string; attributes: { status: string } }> }>(
    api,
    project.id,
    "query-tickets",
    {},
  );
  if (process.argv.includes("--resume")) {
    assert(
      initial.value.rows.every(({ title }) => /^Stress ticket \d+$/.test(title)),
      "Only resume synthetic stress data",
    );
    tickets.push(
      ...initial.value.rows
        .map((row, sortOrder) => ({ id: row.id, title: row.title, statusId: row.attributes.status, sortOrder }))
        .sort((a, b) => a.title.localeCompare(b.title)),
    );
  } else {
    assert.equal(initial.value.rows.length, 0, "Use a fresh dev:playwright stack");
  }
  const statuses = await executePlanner<{
    statuses: Array<{ id: string; isDefault: boolean; canDragIn: boolean; canDragOut: boolean }>;
  }>(api, project.id, "ticket-status.read", {});
  const backlog = statuses.value.statuses.find((status) => status.isDefault)!;
  const ready = statuses.value.statuses.find((status) => !status.isDefault && status.canDragIn && status.canDragOut)!;
  const statusIds = { backlog: backlog.id, ready: ready.id };
  for (const scenario of cases) {
    if (scenario.count < tickets.length) continue;
    console.info(`Starting ${scenario.count} tickets / ${scenario.views} views`);
    await seedStressTickets(api, project.id, tickets, scenario.count, statusIds);
    await configureStressViews(api, project.id, scenario.views, false);
    for (let sample = 0; sample < 3; sample += 1) {
      const moving = tickets[sample % 2];
      const before = tickets[(sample + 1) % 2];
      const reorder = await executePlanner<StressTicket[]>(api, project.id, "reorder-ticket", {
        rowId: moving.id,
        beforeRowId: before.id,
      });
      const query = await executePlanner<{ rows: unknown[] }>(api, project.id, "query-tickets", {});
      assert.equal(query.value.rows.length, scenario.count);
      const saved = {
        ...scenario,
        sample,
        reorderMs: reorder.ms,
        reorderBytes: reorder.bytes,
        queryMs: query.ms,
        queryBytes: query.bytes,
      };
      backend.push(saved);
      console.info(JSON.stringify({ backend: saved }));
    }
    for (const sorted of [false, true]) {
      await configureStressViews(api, project.id, scenario.views, sorted);
      const page = await browser.newPage({ viewport: { width: 1_440, height: 900 } });
      await installPlannerClock(page);
      await page.addInitScript((id) => {
        localStorage.setItem("onboarding-complete", "true");
        localStorage.setItem("dashboard-wb2:selected-project:global", id);
      }, project.id);
      if (connection.dashboardUrl === `http://127.0.0.1:${connection.apiPort}/`) {
        const login = await api.post("/runtime/browser-login");
        assert(login.ok(), await login.text());
        const { url } = await login.json();
        const code = [...new URLSearchParams(new URL(url).hash.slice(1)).values()][0];
        const session = await api.post("/runtime/browser-session", { data: { code } });
        assert(session.ok(), await session.text());
        const { secret } = await session.json();
        await page.addInitScript((secret) => localStorage.setItem("pstdio.browserSession", secret), secret);
      }
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuRate });
      await cdp.send("Profiler.enable");
      const network = recordPlannerRequests(page);
      await page.goto(`${connection.dashboardUrl}projects/${project.id}/extensions/pstdio.pstdio-planner/tickets`);
      await page.getByTestId("renderer-card").first().waitFor();
      await network.settle();
      const cards = await page.getByTestId("renderer-card").count();
      const tabs = await page.getByRole("tab").count();
      assert.equal(tabs, scenario.views);
      const domNodes = await page.locator("*").count();
      for (const interaction of sorted ? ["status"] : ["reorder", "status"]) {
        for (let sample = 0; sample < 3; sample += 1) {
          const row = tickets[0];
          const current = await executePlanner<StressTicket>(api, project.id, "get-ticket", { id: row.id });
          const otherStatus = current.value.statusId === backlog.id ? ready.id : backlog.id;
          const columnId = interaction === "reorder" ? current.value.statusId : otherStatus;
          const column = page.getByTestId(`board-column-${columnId}`);
          const source = page.getByTestId("renderer-card").filter({ hasText: row.title });
          // Virtual boards mount only nearby cards. The oldest ticket in the
          // sorted scenario is at the end; scrolling is setup, outside the clock.
          if ((await source.count()) === 0) {
            await page.locator("[data-board-column-viewport]").evaluateAll((viewports) => {
              for (const viewport of viewports) viewport.scrollTop = viewport.scrollHeight;
            });
            await source.waitFor();
          }
          let target = column;
          let beforeTitle: string | undefined;
          if (interaction === "reorder") {
            const cardTitles = await column.getByTestId("renderer-card").allTextContents();
            const ids = cardTitles.map((text) => tickets.find((ticket) => text.includes(ticket.title))!);
            const position = ids.findIndex(({ id }) => id === row.id);
            const before = position === 0 ? ids[2] : ids[0];
            beforeTitle = before.title;
            target = column.getByTestId("renderer-card").filter({ hasText: beforeTitle }).locator("..");
          }
          await network.settle();
          network.reset();
          const label = `${scenario.count}-${scenario.views}-${sorted ? "sorted" : "manual"}-${interaction}-${sample}`;
          const measured = await measurePlannerDrop({
            page,
            cdp,
            source,
            target,
            title: row.title,
            columnId,
            beforeTitle,
            profilePath: resolve(output, `${label}.cpuprofile`),
            settle: network.settle,
          });
          await network.settle();
          const saved = await executePlanner<StressTicket>(api, project.id, "get-ticket", { id: row.id });
          assert.equal(saved.value.statusId, columnId);
          if (beforeTitle) {
            const before = tickets.find(({ title }) => title === beforeTitle)!;
            const savedBefore = await executePlanner<StressTicket>(api, project.id, "get-ticket", { id: before.id });
            assert(saved.value.sortOrder < savedBefore.value.sortOrder);
          }
          const result = {
            ...scenario,
            sorted,
            interaction,
            sample,
            cards,
            domNodes,
            ...measured,
            commands: [...network.commands],
          };
          results.push(result);
          console.info(JSON.stringify(result));
          await writeFile(resolve(output, "samples.json"), JSON.stringify({ cpuRate, backend, results }, null, 2));
        }
      }
      await page.screenshot({
        path: resolve(output, `${scenario.count}-${scenario.views}-${sorted ? "sorted" : "manual"}.png`),
      });
      await page.close();
    }
  }
  const samples = results as Array<{
    count: number;
    views: number;
    sorted: boolean;
    interaction: string;
    paintMs: number;
  }>;
  for (const scenario of cases) {
    for (const sorted of [false, true]) {
      for (const interaction of sorted ? ["status"] : ["reorder", "status"]) {
        const matching = samples.filter(
          (item) =>
            item.count === scenario.count &&
            item.views === scenario.views &&
            item.sorted === sorted &&
            item.interaction === interaction,
        );
        if (!matching.length) continue;
        assert.equal(matching.length, 3);
        console.info(
          JSON.stringify({
            ...scenario,
            sorted,
            interaction,
            ...summarizeSamples(matching.map(({ paintMs }) => paintMs)),
          }),
        );
      }
    }
  }
  console.info(`Evidence: ${output}`);
} finally {
  await browser.close();
  await api.dispose();
}
