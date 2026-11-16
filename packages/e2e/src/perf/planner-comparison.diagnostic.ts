// Explicit local comparison against disposable Docker projects. No server or database is opened here.
import { strict as assert } from "node:assert";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Page } from "@playwright/test";
import { PROVISIONED_CHROMIUM } from "../packaged/packaged-chromium";
import { signInBrowser } from "../packaged/packaged-serve-helpers";
import { armPlannerAction, readPlannerAction } from "./planner-action-latency";
import { verifyPlannerComparisonSource } from "./planner-comparison-source";
import { installPlannerClock, measurePlannerDrop, recordPlannerRequests } from "./planner-moves-browser";

interface Connection {
  apiPort: number;
  apiToken: string;
  dashboardUrl: string;
  projectId: string;
  side: string;
  bounded: boolean;
  fixture: { movingId: string; archiveIds: string[] };
}
const [connectionPath, outputPath, expectedPlannerSource, properties] = process.argv.slice(2);
if (!connectionPath || !outputPath || !expectedPlannerSource)
  throw new Error("Pass an isolated connection file, evidence folder and expected Planner source folder");
const displayProperties = properties?.split(",") ?? ["id", "priority"];
assert(displayProperties.includes("priority"), "The property edit needs a visible priority");
assert(displayProperties.every((field) => ["id", "priority", "workspace"].includes(field)));
const variant = properties ? ` (${displayProperties.join(", ")})` : "";
const connection: Connection = JSON.parse(await readFile(connectionPath, "utf8"));
assert.equal(new URL(connection.dashboardUrl).hostname, "127.0.0.1");
assert(["main", "candidate"].includes(connection.side));
const output = resolve(outputPath);
await mkdir(output, { recursive: true });
const headers = { authorization: `Bearer ${connection.apiToken}`, "content-type": "application/json" };
const origin = `http://127.0.0.1:${connection.apiPort}`;
const plannerId = connection.side === "candidate" ? "pstdio.planner" : "pstdio.pstdio-planner";
const request = async (path: string, body?: unknown, method = body === undefined ? "GET" : "POST") => {
  const response = await fetch(`${origin}/v1${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert(response.ok, `${method} ${path}: ${response.status}`);
  return response.json();
};
const execute = async (command: string, params: Record<string, unknown> = {}) => {
  const result = await request(
    `/projects/${connection.projectId}/extensions/commands/${plannerId}.command.${command}/execute`,
    { params },
  );
  assert(result.outcome?.ok || result.outcome?.status === "success", `${command} failed`);
  return result.outcome.value;
};
const source = await verifyPlannerComparisonSource(
  expectedPlannerSource,
  await request(`/projects/${connection.projectId}/extensions`),
  plannerId,
);
await writeFile(resolve(output, "source-identity.json"), JSON.stringify(source, null, 2));
const { archiveIds } = connection.fixture;
assert.equal(archiveIds.length, 205);
await execute("unarchive-ticket", { id: archiveIds[0] });
const moving = { id: connection.fixture.movingId };
const ticket = await execute("get-ticket", { id: moving.id });
assert(ticket.title.startsWith("Demo focus "), "Only synthetic comparison tickets may be changed");
await execute("set-ticket-attribute", { rowId: moving.id, attributeId: "priority", value: [] });
const boardPath = `/projects/${connection.projectId}/boards/${plannerId}.view.tickets`;
const views = await request(`${boardPath}/views`);
const definition = {
  title: `Linked comparison 25 of 5,000${variant}`,
  settings: { viewMode: "board", rowGrouping: "none", columnGrouping: "status", displayProperties },
  filter: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "Demo focus" }] },
  sorts: [],
};
const existing = views.views.find((view: { title: string }) => view.title === definition.title);
if (existing) await request(`/projects/${connection.projectId}/board-views/${existing.id}`, definition, "PATCH");
const view = existing ?? (await request(`${boardPath}/views`, definition));
const archiveTitle = `Archive comparison 205 of 5,000${variant}`;
const archiveDefinition = {
  ...definition,
  title: archiveTitle,
  filter: {
    conjunction: "and",
    rules: [
      { attributeId: "status", condition: "is-any-of", value: ["done"] },
      { attributeId: "archived", condition: "is-any-of", value: ["active"] },
    ],
  },
};
const archiveView = views.views.find((view: { title: string }) => view.title === archiveTitle);
if (archiveView)
  await request(`/projects/${connection.projectId}/board-views/${archiveView.id}`, archiveDefinition, "PATCH");
else await request(`${boardPath}/views`, archiveDefinition);
await request(`${boardPath}/views/default`, { viewId: view.id }, "PUT");
const boardUrl = `${connection.dashboardUrl}projects/${connection.projectId}/extensions/${plannerId}/tickets`;
const browser = await chromium.launch(PROVISIONED_CHROMIUM);
let failurePage: Page | undefined;
let archiving = false;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(30_000);
  failurePage = page;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installPlannerClock(page);
  await page.addInitScript(() => {
    if (window.top === window) localStorage.setItem("onboarding-complete", "true");
  });
  if (new URL(connection.dashboardUrl).port === String(connection.apiPort))
    await signInBrowser(page, { origin, token: connection.apiToken });
  const network = recordPlannerRequests(page);
  let phase = "board";
  const requests: { path: string; ms: number; type: string; phase: string; operation?: string }[] = [];
  page.on("requestfinished", (request) => {
    const timing = request.timing();
    if (request.url().startsWith(connection.dashboardUrl) && timing.responseEnd >= 100)
      requests.push({
        path: new URL(request.url()).pathname,
        ms: Math.round(timing.responseEnd),
        type: request.resourceType(),
        phase,
        ...(request.url().includes("/text-editing/request")
          ? { operation: request.postDataJSON()?.request?.operation }
          : {}),
      });
  });
  const pages: { command: string; rows: number; bytes: number; total?: number; fields?: string[] }[] = [];
  page.on("response", async (response) => {
    if (!response.url().includes("/extensions/commands/") || !response.url().endsWith("/execute")) return;
    const body = await response.body().catch(() => Buffer.alloc(0));
    try {
      const value = JSON.parse(body.toString()).outcome?.value;
      if (Array.isArray(value?.rows))
        pages.push({
          command: response.url().split("/commands/")[1].split("/execute")[0],
          rows: value.rows.length,
          bytes: body.length,
          total: value.page?.total,
          fields: response.request().postDataJSON()?.params?.page?.fields,
        });
    } catch {
      /* Failed responses remain visible in the network evidence. */
    }
  });
  const started = performance.now();
  console.log({ phase: "board-open", side: connection.side });
  await page.goto(boardUrl);
  const card = () => page.getByTestId("renderer-card").filter({ hasText: ticket.title });
  await card().waitFor();
  if (displayProperties.includes("workspace"))
    await card()
      .getByText(/Foobar focus /)
      .waitFor();
  const boardMs = Math.round(performance.now() - started);
  console.log({ phase: "board-ready", boardMs });
  await network.settle();
  await page.screenshot({ path: resolve(output, "board.png") });
  const session = await page.context().newCDPSession(page);
  await session.send("Profiler.enable");
  await session.send("Profiler.start");
  const opening = performance.now();
  phase = "opening";
  await card().getByText(ticket.title, { exact: true }).click();
  await page
    .locator('[data-workbench-region="main"] [contenteditable="true"]')
    .filter({ hasText: ticket.title })
    .first()
    .waitFor();
  const openingMs = Math.round(performance.now() - opening);
  const openingProfile = await session.send("Profiler.stop");
  await writeFile(resolve(output, "opening.cpuprofile"), JSON.stringify(openingProfile.profile));
  console.log({ phase: "ticket-ready", openingMs });
  await network.settle();
  await page.screenshot({ path: resolve(output, "ticket.png") });
  phase = "property";
  await page.goto(boardUrl);
  await card().waitFor();
  await network.settle();
  const property = card().getByRole("button", { name: /^(Priority|High)$/ });
  const menuStarted = performance.now();
  await property.click();
  const high = page.getByRole("menuitemradio", { name: "High", exact: true });
  await high.waitFor();
  const menuMs = Math.round(performance.now() - menuStarted);
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/execute") && response.request().postDataJSON()?.params?.attributeId === "priority",
  );
  await armPlannerAction(page, "property", ticket.title);
  const editing = performance.now();
  await high.click();
  await card().getByRole("button", { name: "High", exact: true }).waitFor();
  const propertyPaintMs = Math.round(performance.now() - editing);
  assert((await saved).ok());
  await network.settle();
  const propertySettledMs = Math.round(performance.now() - editing);
  const propertyAction = await readPlannerAction(page);
  const destination = ticket.statusId === "ready" ? "backlog" : "ready";
  phase = "move";
  const move = await measurePlannerDrop({
    page,
    cdp: session,
    source: card(),
    target: page.getByTestId(`board-column-${destination}`),
    title: ticket.title,
    columnId: destination,
    profilePath: resolve(output, "move.cpuprofile"),
    settle: network.settle,
  });
  assert.equal((await execute("get-ticket", { id: moving.id })).statusId, destination);
  await execute("update-ticket", { id: moving.id, statusId: ticket.statusId });
  await network.settle();
  const foobarStarted = performance.now();
  phase = "foobar";
  await page.goto(`${connection.dashboardUrl}projects/${connection.projectId}/extensions/demo.foobar/foobars`);
  await page.getByText("Foobar background 0001", { exact: true }).waitFor();
  const foobarMs = Math.round(performance.now() - foobarStarted);
  await network.settle();
  await page.screenshot({ path: resolve(output, "foobar.png") });
  phase = "archive";
  await page.goto(boardUrl);
  await page.getByRole("tab", { name: archiveTitle, exact: true }).click();
  await page.getByText("Demo background 0001", { exact: true }).waitFor();
  await network.settle();
  const archiveResponse = page.waitForResponse((response) => response.url().includes(".kanban.onColumnAction/execute"));
  await page.getByRole("button", { name: "Column actions for Done", exact: true }).click();
  archiving = true;
  await armPlannerAction(page, "archive");
  const archiveStarted = performance.now();
  await page.getByRole("menuitem", { name: "Archive all", exact: true }).click();
  const archived = await archiveResponse;
  assert(archived.ok());
  const archivedValue = (await archived.json()).outcome.value;
  assert.equal(archivedValue.archivedCount ?? archivedValue.archived?.length, 205);
  const archiveSavedMs = Math.round(performance.now() - archiveStarted);
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="renderer-card"]').length === 0);
  await network.settle();
  const archiveSettledMs = Math.round(performance.now() - archiveStarted);
  const archiveAction = await readPlannerAction(page);
  await page.screenshot({ path: resolve(output, "archive.png") });
  if (connection.bounded)
    assert(
      pages.every(({ rows }) => rows <= 500),
      "A renderer returned an unbounded resource result",
    );
  assert.deepEqual(errors, []);
  const evidence = {
    side: connection.side,
    source,
    workload: {
      tickets: 5000,
      foobars: 5000,
      linkedFocusTickets: 25,
      reviewRequests: 25,
      historyEdits: 50,
      displayProperties,
      genericResourceLinks: displayProperties.includes("workspace") ? 25 : undefined,
    },
    chromium: browser.version(),
    boardMs,
    openingMs,
    menuMs,
    propertyPaintMs,
    propertySettledMs,
    propertyAction,
    move,
    foobarMs,
    archiveSavedMs,
    archiveSettledMs,
    archiveAction,
    pages,
    commands: network.commands,
    browserErrors: errors,
  };
  await writeFile(resolve(output, "measurements.json"), JSON.stringify(evidence, null, 2));
  await writeFile(resolve(output, "requests.json"), JSON.stringify(requests, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  if (connection.bounded) {
    for (const [action, result] of [
      ["property", propertyAction],
      ["archive", archiveAction],
    ] as const)
      assert(
        result.readyMs < 800,
        `${action} click-to-save-and-reconciliation took ${result.readyMs.toFixed(1)}ms; needs <800ms`,
      );
  }
} catch (error) {
  if (failurePage) {
    await writeFile(
      resolve(output, "failure-action-clock.json"),
      JSON.stringify(
        await failurePage.evaluate(() => ({
          clock: window.__plannerActionClock,
          resources: (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).map((entry) => ({
            path: new URL(entry.name).pathname,
            startTime: entry.startTime,
            responseEnd: entry.responseEnd,
          })),
        })),
        null,
        2,
      ),
    );
    await failurePage.screenshot({ path: resolve(output, "failure.png") });
    await writeFile(
      resolve(output, "failure-dom.txt"),
      (await failurePage.locator("body").innerText()).slice(0, 20000),
    );
  }
  await writeFile(resolve(output, "failure.txt"), String(error));
  throw error;
} finally {
  await browser.close();
  if (archiving)
    for (let start = 0; start < archiveIds.length; start += 8)
      await Promise.all(archiveIds.slice(start, start + 8).map((id) => execute("unarchive-ticket", { id })));
}
