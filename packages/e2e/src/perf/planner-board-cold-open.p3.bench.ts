import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { benchmarkSampleCount, findBudgetFailures, plannerBudget } from "pstdio-benchmarks";
import { recordMeasurement } from "pstdio-benchmarks/writer";
import { folderProjectInput } from "../helpers/folder-project";
import { buildBinary, PACKAGED_BINARY_PATH } from "../packaged/packaged-helpers";
import { preparePlannerSource } from "../packaged/packaged-planner-source";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "../packaged/packaged-serve-helpers";
import { summarizeSamples } from "./perf-helpers";

const repoRoot = join(import.meta.dirname, "../../../..");
const board = "pstdio.pstdio-planner.view.tickets";
// The saved view filters by stored option IDs. While loading, none of them may reach the screen.
const rawLabels = /\bin-progress\b|default-priority-low|Unavailable field/;
// Set on 2026-10-26 from four hosted ubuntu-24.04 runs (slowest sample 2,426 ms) plus about 20%.
const targetMs = plannerBudget.value;

interface Fixture {
  projectId: string;
  tickets: number;
}

const option = (name: string, fallback: number) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]! : String(fallback);
};

const startRuntime = async (home: string) => {
  const started = await startPackagedServe(home, { PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1" });
  const headers = { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" };
  const execute = async <T>(projectId: string, command: string, params: Record<string, unknown>) => {
    const response = await fetch(
      `${started.baseUrl}/v1/projects/${projectId}/extensions/commands/pstdio.pstdio-planner.command.${command}/execute`,
      { method: "POST", headers, body: JSON.stringify({ params }) },
    );
    const body = (await response.json()) as { outcome: { status: string; value: T } };
    if (body.outcome.status !== "success") throw new Error(`${command}: ${JSON.stringify(body)}`);
    return body.outcome.value;
  };
  return { ...started, headers, execute };
};

const saveFilteredView = async (runtime: Awaited<ReturnType<typeof startRuntime>>, projectId: string) => {
  const boardUrl = `${runtime.baseUrl}/v1/projects/${projectId}/boards/${board}`;
  const view = await fetch(`${boardUrl}/views`, {
    method: "POST",
    headers: runtime.headers,
    body: JSON.stringify({
      title: "In flight",
      settings: { viewMode: "board", rowGrouping: "none", columnGrouping: "status", displayProperties: ["id"] },
      filter: {
        conjunction: "and",
        rules: [
          { attributeId: "archived", condition: "is-any-of", value: ["active"] },
          { attributeId: "status", condition: "is-any-of", value: ["ready", "in-progress"] },
          { attributeId: "priority", condition: "is-none-of", value: ["default-priority-low"] },
        ],
      },
      sorts: [{ attributeId: "created", direction: "desc" }],
    }),
  });
  const { id } = (await view.json()) as { id: string };
  await fetch(`${boardUrl}/views/default`, {
    method: "PUT",
    headers: runtime.headers,
    body: JSON.stringify({ viewId: id }),
  });
};

const installPlanner = async (
  runtime: Awaited<ReturnType<typeof startRuntime>>,
  home: string,
  plannerSource?: string,
) => {
  const source = await preparePlannerSource(join(home, "fixtures"), { sourcePath: plannerSource });
  const env = { ...process.env, HOME: home, PSTDIO_HOME: home };
  const added = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "add", source, "--name", "pstdio-planner", "--force"], {
    cwd: join(home, "project"),
    env: { ...env, PSTDIO_API_URL: runtime.baseUrl, PSTDIO_API_TOKEN: runtime.descriptor.token },
    stdio: ["ignore", "ignore", "inherit"],
  });
  if (added.status !== 0) throw new Error("Installing Planner failed.");
};

const editedContent = (title: string, edit: number) =>
  `# ${title}\n\n${"Revised plan details. ".repeat(60)}\n\nEdit ${edit}`;

// Seeds the tickets, a saved filtered view, and edit history before restarting the runtime.
const seedHome = async (home: string, edits: number, plannerSource?: string) => {
  const runtime = await startRuntime(home);
  try {
    const folder = join(home, "project");
    mkdirSync(folder, { recursive: true });
    const projects = await fetch(`${runtime.baseUrl}/v1/projects`, { headers: runtime.headers });
    if (!projects.ok) throw new Error(`Reading projects failed: HTTP ${projects.status}`);
    const existing = ((await projects.json()) as { name: string }[]).some((project) => project.name === "project");
    if (!existing) {
      const created = await fetch(`${runtime.baseUrl}/v1/projects`, {
        method: "POST",
        headers: runtime.headers,
        body: JSON.stringify(folderProjectInput({ name: "project" }, folder)),
      });
      if (!created.ok) throw new Error(`Creating the project failed: HTTP ${created.status}`);
    }
    await installPlanner(runtime, home, plannerSource);
    const connection = join(home, "connection.json");
    const port = Number(new URL(runtime.baseUrl).port);
    writeFileSync(
      connection,
      JSON.stringify({ apiPort: port, apiToken: runtime.descriptor.token, dashboardUrl: runtime.baseUrl }),
    );
    const seeded = spawnSync("bun", [join(repoRoot, "scripts/dev/seed-planner-stress.ts"), connection], {
      stdio: ["ignore", "pipe", "inherit"],
      encoding: "utf8",
    });
    if (seeded.status !== 0) throw new Error("Seeding tickets failed.");
    const fixture = JSON.parse(seeded.stdout.trim()) as Fixture;
    await saveFilteredView(runtime, fixture.projectId);
    const tickets = await runtime.execute<{ id: string; title: string; content: string }[]>(
      fixture.projectId,
      "read-tickets",
      {},
    );
    for (const [index, ticket] of tickets.entries()) {
      const completed =
        Array.from({ length: edits }, (_, index) => index + 1).findLast(
          (edit) => ticket.content === editedContent(ticket.title, edit),
        ) ?? 0;
      for (let edit = completed + 1; edit <= edits; edit++)
        await runtime.execute(fixture.projectId, "update-ticket", {
          id: ticket.id,
          content: editedContent(ticket.title, edit),
        });
      if (index % 100 === 99) process.stderr.write(`Edited ${index + 1}/${tickets.length} tickets\n`);
    }
    writeFileSync(join(home, "fixture.json"), JSON.stringify(fixture));
    return fixture;
  } finally {
    await stopProcess(runtime.child);
  }
};

// Restarts the runtime so Planner storage has no cached projection, then opens Tickets in a new browser.
const measureColdOpen = async (home: string, fixture: Fixture) => {
  const runtime = await startRuntime(home);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await page.addInitScript(() => {
      if (window.top === window) localStorage.setItem("onboarding-complete", "true");
      const tasks: number[] = [];
      Object.assign(window, { coldOpenLongTasks: tasks });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) tasks.push(Math.round(entry.duration));
      }).observe({ type: "longtask", buffered: true });
    });
    const response = await fetch(`${runtime.baseUrl}/runtime/browser-login`, {
      method: "POST",
      headers: runtimeAuthorization(runtime.descriptor),
    });
    if (!response.ok) throw new Error(`Browser login failed with HTTP ${response.status}`);
    const login = new URL(((await response.json()) as { url: string }).url);
    login.pathname = `/projects/${fixture.projectId}/extensions/pstdio.pstdio-planner/tickets`;
    if (page.url() !== "about:blank") throw new Error("Cold open must use the browser's first page navigation.");
    const started = performance.now();
    try {
      await page.goto(login.href, { waitUntil: "commit" });
    } catch {
      throw new Error("Opening Tickets failed before the page committed.");
    }
    let rawLabelsShown = false;
    // A board shows cards and a list shows rows; the saved view decides which.
    const ticket = page.locator('[data-testid="renderer-card"], [data-testid="row-status-icon"]').first();
    while (!(await ticket.isVisible())) {
      if (performance.now() - started > 30_000) throw new Error("No ticket appeared within 30 seconds.");
      if (rawLabels.test(await page.locator("body").innerText())) rawLabelsShown = true;
      await page.waitForTimeout(25);
    }
    const firstTicketMs = Math.round(performance.now() - started);
    const diagnostics = await page.evaluate(() => ({
      longTasksMs: (window as unknown as Window & { coldOpenLongTasks: number[] }).coldOpenLongTasks,
      resources: performance
        .getEntriesByType("resource")
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 12)
        .map((entry) => ({
          path: new URL(entry.name).pathname,
          startMs: Math.round(entry.startTime),
          durationMs: Math.round(entry.duration),
        })),
    }));
    return { firstTicketMs, rawLabelsShown, diagnostics };
  } finally {
    await browser.close();
    await stopProcess(runtime.child);
  }
};

async function main() {
  if (process.argv.includes("--help")) {
    process.stdout.write(`Time the first Tickets card or row after a compiled runtime restart with 1,000 tickets
(or --tickets <count>).

bun run --cwd packages/e2e perf:planner-board-cold-open
bun run --cwd packages/e2e perf:planner-board-cold-open -- --home <dir>   # keep and reuse the seeded home
bun run --cwd packages/e2e perf:planner-board-cold-open -- --edits 3
bun run --cwd packages/e2e perf:planner-board-cold-open -- --tickets 10000
bun run --cwd packages/e2e perf:planner-board-cold-open -- --planner-source <dir>

Reports every sample against the ${targetMs} ms target. Seeding takes several minutes.
`);
    return;
  }
  // The seed script reads the count from the environment it inherits.
  if (process.argv.includes("--tickets")) process.env.PSTDIO_PLANNER_STRESS_TICKETS = option("--tickets", 1000);
  buildBinary();
  const kept = process.argv.includes("--home") ? option("--home", 0) : undefined;
  const home = kept ?? mkdtempSync(join(tmpdir(), "pstdio-planner-cold-open-"));
  mkdirSync(home, { recursive: true });
  try {
    const fixturePath = join(home, "fixture.json");
    const seeded = existsSync(fixturePath);
    const plannerSource = process.argv.includes("--planner-source") ? option("--planner-source", 0) : undefined;
    const fixture = seeded
      ? (JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture)
      : await seedHome(home, Number(option("--edits", 3)), plannerSource);
    const requested = Number(option("--tickets", fixture.tickets));
    if (fixture.tickets !== requested)
      throw new Error(`This home holds ${fixture.tickets} tickets, not ${requested}. Use a fresh --home.`);
    if (seeded && plannerSource) {
      const runtime = await startRuntime(home);
      try {
        await installPlanner(runtime, home, plannerSource);
      } finally {
        await stopProcess(runtime.child);
      }
    }
    const samples = [];
    for (let sample = 0; sample < benchmarkSampleCount(3); sample++) samples.push(await measureColdOpen(home, fixture));
    const firstTicket = summarizeSamples(samples.map((sample) => sample.firstTicketMs));
    for (const sample of samples) {
      recordMeasurement({
        metric: "cold-open",
        label: `Open Tickets with ${fixture.tickets.toLocaleString("en-US")} tickets after a restart`,
        unit: "ms",
        value: sample.firstTicketMs,
        budget: targetMs,
      });
    }
    const failures = findBudgetFailures(
      samples.map((sample) => ({
        name: "Planner cold open",
        unit: "ms",
        value: sample.firstTicketMs,
        budget: targetMs,
      })),
    );
    process.stdout.write(
      `${JSON.stringify(
        {
          tickets: fixture.tickets,
          platform: `${process.platform}/${process.arch}`,
          targetMs,
          withinTarget: !failures.length,
          failures,
          firstTicketMs: firstTicket,
          rawLabelsShown: samples.some((sample) => sample.rawLabelsShown),
          samples,
        },
        null,
        2,
      )}\n`,
    );
    if (failures.length || samples.some((sample) => sample.rawLabelsShown)) process.exitCode = 1;
  } finally {
    if (!kept) rmSync(home, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
