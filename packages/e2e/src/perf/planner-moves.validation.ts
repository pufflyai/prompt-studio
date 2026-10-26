import { strict as assert } from "node:assert";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Page, request } from "@playwright/test";
import { configureStressViews, executePlanner, type StressTicket } from "./planner-stress-fixture";

const repo = resolve(import.meta.dirname, "../../../..");
const connection = JSON.parse(
  await readFile(resolve(repo, "__test-tmp__/dev-isolated/pstdio-playwright/connection.json"), "utf8"),
);
const api = await request.newContext({
  baseURL: `http://127.0.0.1:${connection.apiPort}`,
  extraHTTPHeaders: { authorization: `Bearer ${connection.apiToken}` },
});
const project = (await (await api.get("/v1/projects")).json()).find(
  (item: { name: string }) => item.name === "project",
);
assert(project);
const output = resolve(repo, "__test-tmp__/planner-validation", String(Date.now()));
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const query = await executePlanner<{ rows: Array<{ id: string; title: string }> }>(
  api,
  project.id,
  "query-tickets",
  {},
);
assert.equal(query.value.rows.length, 1_000, "Run the complete stress workload first");
assert(query.value.rows.every(({ title }) => /^Stress ticket \d+/.test(title)));
const tickets = query.value.rows;

const openPage = async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const login = await (await api.post("/runtime/browser-login")).json();
  const code = [...new URLSearchParams(new URL(login.url).hash.slice(1)).values()][0];
  const { secret } = await (await api.post("/runtime/browser-session", { data: { code } })).json();
  await page.addInitScript(
    ({ id, secret }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", id);
      localStorage.setItem("pstdio.browserSession", secret);
    },
    { id: project.id, secret },
  );
  await page.goto(`${connection.dashboardUrl}projects/${project.id}/extensions/pstdio.pstdio-planner/tickets`);
  await page.getByTestId("renderer-card").first().waitFor();
  return page;
};
const revealCard = async (page: Page, columnId: string, title: string) => {
  const viewport = page.locator(`[data-board-column-viewport="${columnId}"]`);
  const card = page.getByTestId(`board-column-${columnId}`).getByTestId("renderer-card").filter({ hasText: title });
  await viewport.evaluate((element) => {
    element.scrollTop = 0;
  });
  while ((await card.count()) === 0) {
    const advanced = await viewport.evaluate((element) => {
      const previous = element.scrollTop;
      element.scrollTop += element.clientHeight;
      return element.scrollTop > previous;
    });
    await page.waitForTimeout(20);
    assert(advanced || (await card.count()) > 0, "Persisted card must be present in its column");
  }
  await card.scrollIntoViewIfNeeded();
};

const drop = async (page: Page, title: string, columnId: string, beforeTitle?: string) => {
  const source = page.getByTestId("renderer-card").filter({ hasText: title });
  const column = page.getByTestId(`board-column-${columnId}`);
  const target = beforeTitle
    ? column.getByTestId("renderer-card").filter({ hasText: beforeTitle }).locator("..")
    : column;
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent("dragstart", { dataTransfer: transfer });
  await target.dispatchEvent("dragover", { dataTransfer: transfer });
  await target.dispatchEvent("drop", { dataTransfer: transfer });
  await transfer.dispose();
};

try {
  // Supplement the baseline; retain all 1,000 tickets and their original bodies.
  if (!process.argv.includes("--resume")) {
    for (let index = 0; index < 20; index += 1) {
      await executePlanner(api, project.id, "update-ticket", {
        id: tickets[index].id,
        title: `${tickets[index].title} ${"Variable height instructions. ".repeat(index % 4)}`,
        ...(index ? { dependsOn: [tickets[index - 1].id] } : {}),
      });
      const file = await executePlanner<{ id: string }>(api, project.id, "create-ticket-file", {
        ticketId: tickets[index].id,
        name: "details.md",
      });
      await executePlanner(api, project.id, "update-ticket-file", {
        ticketId: tickets[index].id,
        fileId: file.value.id,
        content: "Attached instructions.\n".repeat(3_000),
      });
    }
    for (const ticket of tickets.slice(0, 2)) {
      const response = await api.post("/v1/workspaces", {
        data: {
          project_id: project.id,
          provider_id: "pstdio.worktree",
          params: { base: "master" },
          anchors: [{ type: "ticket", id: ticket.id, role: "primary" }],
        },
      });
      assert(response.ok(), await response.text());
    }
    for (const ticket of tickets.slice(2, 6))
      await executePlanner(api, project.id, "request-human", {
        ticket: ticket.id,
        title: "Synthetic review",
        instructions: "Confirm this synthetic task.",
        request: { kind: "task" },
      });
  }
  await configureStressViews(api, project.id, 15, false);
  const page = await openPage();
  const title = tickets[0].title;
  console.info(JSON.stringify({ validatingTicket: tickets[0].id, title }));
  const current = await executePlanner<StressTicket>(api, project.id, "get-ticket", { id: tickets[0].id });
  const statuses = await executePlanner<{ statuses: Array<{ id: string }> }>(api, project.id, "ticket-status.read", {});
  const destination = statuses.value.statuses.find(({ id }) => id !== current.value.statusId)!;
  const sourceViewport = page.locator(`[data-board-column-viewport="${current.value.statusId}"]`);
  await sourceViewport.evaluate((element) => {
    element.scrollTop = 0;
  });
  const first = page.getByTestId("renderer-card").filter({ hasText: title }).locator("..");
  await first.waitFor();
  assert((await page.getByTestId("renderer-card").count()) < 100);
  await first.focus();
  await first.press("End");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-board-key") !== null);
  assert(await sourceViewport.evaluate((element) => element.scrollTop > 0));
  await page.keyboard.press("Home");
  await first.click({ button: "right" });
  await page.getByRole("menu").waitFor();
  await page.keyboard.press("Escape");

  const bounds = (await sourceViewport.boundingBox())!;
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await first.getByTestId("renderer-card").dispatchEvent("dragstart", { dataTransfer: transfer });
  await sourceViewport.dispatchEvent("dragover", {
    dataTransfer: transfer,
    clientX: bounds.x + bounds.width / 2,
    clientY: bounds.y + bounds.height - 2,
  });
  await page.waitForFunction(
    (id) => document.querySelector(`[data-board-column-viewport="${id}"]`)!.scrollTop > 0,
    current.value.statusId,
  );
  await first.getByTestId("renderer-card").dispatchEvent("dragend", { dataTransfer: transfer });
  await transfer.dispose();
  await sourceViewport.evaluate((element) => {
    element.scrollTop = 0;
  });

  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let secondMoveSaved!: (ok: boolean) => void;
  const secondMove = new Promise<boolean>((resolve) => {
    secondMoveSaved = resolve;
  });
  let moveCalls = 0;
  await page.route("**/pstdio.pstdio-planner.view.tickets.kanban.onMove/execute", async (route) => {
    moveCalls += 1;
    console.info(JSON.stringify({ move: moveCalls, payload: route.request().postDataJSON() }));
    if (moveCalls > 1) {
      const response = await route.fetch();
      secondMoveSaved(response.ok());
      return route.fulfill({ response });
    }
    await gate;
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "synthetic_failure", detail: "Synthetic move failure" } }),
    });
  });
  await drop(page, title, destination.id);
  const destinationColumn = page.getByTestId(`board-column-${destination.id}`);
  await destinationColumn.getByTestId("renderer-card").filter({ hasText: title }).waitFor();
  const before = (await destinationColumn.getByTestId("renderer-card").allTextContents()).find(
    (text) => !text.includes(title),
  )!;
  const beforeTitle = tickets.find((ticket) => before.includes(ticket.title))!.title;
  await drop(page, title, destination.id, beforeTitle);
  release();
  await page.waitForFunction(() => document.body.textContent?.includes("Synthetic move failure"));
  // The error shows before the queued second move finishes, so read storage only after it saved.
  assert(await secondMove);
  let saved = await executePlanner<StressTicket>(api, project.id, "get-ticket", { id: tickets[0].id });
  assert.equal(moveCalls, 2);
  assert.equal(saved.value.statusId, destination.id);
  const savedBefore = await executePlanner<StressTicket>(api, project.id, "get-ticket", {
    id: tickets.find(({ title }) => title === beforeTitle)!.id,
  });
  assert(saved.value.sortOrder < savedBefore.value.sortOrder);
  await page.screenshot({ path: resolve(output, "variable-height-failure-recovery.png") });
  const second = await openPage();
  await revealCard(second, destination.id, title);
  await second
    .getByTestId(`board-column-${destination.id}`)
    .getByTestId("renderer-card")
    .filter({ hasText: title })
    .waitFor();
  await page.reload();
  await page.getByTestId("renderer-card").first().waitFor();
  await revealCard(page, destination.id, title);
  await page
    .getByTestId(`board-column-${destination.id}`)
    .getByTestId("renderer-card")
    .filter({ hasText: title })
    .waitFor();
  saved = await executePlanner<StressTicket>(api, project.id, "get-ticket", { id: tickets[0].id });
  assert.equal(saved.value.statusId, destination.id);
  // Validate flattened group headers and pinned drag/focus entries in the built app.
  const viewPath = `/v1/projects/${project.id}/boards/pstdio.pstdio-planner.view.tickets/views`;
  const { views } = await (await api.get(viewPath)).json();
  const activeView = views[0];
  const settingsPath = `/v1/projects/${project.id}/board-views/${activeView.id}`;
  assert(
    (await api.patch(settingsPath, { data: { settings: { ...activeView.settings, rowGrouping: "priority" } } })).ok(),
  );
  await page.reload();
  await page.getByTestId("renderer-card").first().waitFor();
  const groupedColumn = page.getByTestId(`board-column-${destination.id}`);
  const header = groupedColumn.locator("[aria-expanded]").first();
  await header.click();
  assert.equal(await header.getAttribute("aria-expanded"), "false");
  await header.click();
  const groupedCard = groupedColumn.getByTestId("renderer-card").first();
  const groupedEntry = groupedCard.locator("..");
  const entryKey = await groupedEntry.getAttribute("data-board-key");
  assert(entryKey && JSON.parse(entryKey).length === 4);
  await groupedEntry.focus();
  await groupedEntry.press("End");
  await page.waitForFunction(() => {
    const key = document.activeElement?.getAttribute("data-board-key");
    return key && JSON.parse(key)[0] === "row";
  });
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  const dragCard = groupedColumn.getByTestId("renderer-card").first();
  const dragKey = await dragCard.locator("..").getAttribute("data-board-key");
  const groupTransfer = await page.evaluateHandle(() => new DataTransfer());
  await dragCard.dispatchEvent("dragstart", { dataTransfer: groupTransfer });
  await page.locator(`[data-board-column-viewport="${destination.id}"]`).evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page.waitForTimeout(100);
  assert.equal(
    await page
      .locator("[data-board-key]")
      .evaluateAll(
        (elements, key) => elements.filter((element) => element.getAttribute("data-board-key") === key).length,
        dragKey,
      ),
    1,
  );
  const keys = await page
    .locator("[data-board-key]")
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("data-board-key")));
  assert.equal(new Set(keys).size, keys.length);
  await dragCard.dispatchEvent("dragend", { dataTransfer: groupTransfer });
  await groupTransfer.dispose();
  await page.screenshot({ path: resolve(output, "grouped-drag-focus.png") });
  assert((await api.patch(settingsPath, { data: { settings: activeView.settings } })).ok());
  const result = {
    tickets: 1_000,
    views: 15,
    workspaces: 2,
    dependencyEdges: 19,
    openRequests: 4,
    attachedFiles: 20,
    attachedBytes: 20 * 3_000 * Buffer.byteLength("Attached instructions.\n"),
    mountedCards: await page.getByTestId("renderer-card").count(),
    checks: [
      "keyboard navigation",
      "context menu",
      "variable heights",
      "vertical drag scrolling",
      "failed earlier save preserves later destination",
      "persisted order",
      "reload",
      "second client",
      "group collapse and expansion",
      "grouped keyboard focus and drag pin",
      "unique grouped visual keys",
    ],
  };
  await writeFile(resolve(output, "validation.json"), JSON.stringify(result, null, 2));
  console.info(JSON.stringify(result));
  console.info(`Evidence: ${output}`);
} finally {
  await browser.close();
  await api.dispose();
}
