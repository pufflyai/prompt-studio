import { expect, type Page } from "@playwright/test";
import { exerciseGroupedPageSelection } from "./paged-collection-group-selection";
import { observeCollectionReadiness } from "./paged-collection-readiness";

interface PageEvidence {
  view: string;
  elapsedMs: number;
  rows: number;
  responseBytes: number;
}

/** Shared by the isolated Docker walkthrough and the compiled-package browser check. */
export const exercisePagedCollections = async (
  page: Page,
  baseUrl: string,
  projectId: string,
  recordEvidence: (samples: PageEvidence[]) => Promise<void>,
  moveFirstRow: (rank: number) => Promise<void>,
) => {
  const evidence: PageEvidence[] = [];
  const expectedSelection: string[] = [];
  const commandBodies: Promise<string>[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/commands/") && response.url().endsWith("/execute"))
      commandBodies.push(response.text().catch(() => ""));
  });
  const isQuery = (url: string, owner: number, kind: "table" | "board") =>
    url.includes(`example.paged-owner-${owner}.view.${kind}.`) && url.endsWith(".query/execute");
  const nextResult = (owner: number, kind: "table" | "board", offset = 0) =>
    page.waitForResponse((response) => {
      if (!isQuery(response.url(), owner, kind) || response.request().method() !== "POST") return false;
      return response.request().postDataJSON()?.params?.page?.offset === offset;
    });
  await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
  await page.goto(`${baseUrl}/projects/${projectId}`);
  await expect(page.getByRole("option", { name: "paged-owner-0 table", exact: true })).toBeVisible();
  for (let owner = 0; owner < 10; owner++) {
    const pending = nextResult(owner, "table");
    const readiness = await observeCollectionReadiness(page, "table", owner);
    await page.getByRole("option", { name: `paged-owner-${owner} table`, exact: true }).click();
    const elapsedMs = await readiness();
    const response = await pending;
    const text = await response.text();
    const result = JSON.parse(text).outcome.value;
    expect(result.rows).toHaveLength(100);
    if (owner === 0) expectedSelection.push(result.rows[0].id);
    expect(result.rows[0].values.title).toBe(`paged-owner-${owner} row 0000`);
    expect(result.rows[99].values.title).toBe(`paged-owner-${owner} row 0099`);
    expect(text).not.toContain("OFF_PAGE_BODY");
    await expect(page.getByRole("cell", { name: new RegExp(`^paged-owner-${owner} row `) })).toHaveCount(100);
    await expect(page.getByRole("cell", { name: `paged-owner-${owner} row 0000`, exact: true })).toBeVisible();
    evidence.push({ view: `owner-${owner}-table`, elapsedMs, rows: 100, responseBytes: text.length });
  }
  await page.getByRole("option", { name: "paged-owner-0 table", exact: true }).click();
  await expect(page.getByRole("cell", { name: "paged-owner-0 row 0000", exact: true })).toBeVisible();
  const continuation = nextResult(0, "table", 100);
  await page.getByRole("button", { name: "Go to next page", exact: true }).click();
  const continued = await (await continuation).json();
  expectedSelection.push(continued.outcome.value.rows[0].id);
  expect(continued.outcome.value.rows[0].values.title).toBe("paged-owner-0 row 0100");
  await expect(page.getByRole("cell", { name: "paged-owner-0 row 0100", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Go to first page", exact: true }).click();
  await expect(page.getByRole("cell", { name: "paged-owner-0 row 0000", exact: true })).toBeVisible();

  // Hold transport so a second click sees the still-displayed first-page cursor.
  const gate = Promise.withResolvers<void>();
  await page.route("**/commands/*/execute", async (route) => {
    if (isQuery(route.request().url(), 0, "table") && route.request().postDataJSON()?.params?.page?.offset > 0)
      await gate.promise;
    await route.continue().catch(() => {});
  });
  try {
    const finalPage = nextResult(0, "table", 200);
    await page.getByRole("button", { name: "Go to next page", exact: true }).click();
    await expect(page.getByRole("spinbutton")).toHaveValue("1");
    const firstRow = page
      .getByRole("row")
      .filter({ has: page.getByRole("cell", { name: "paged-owner-0 row 0000", exact: true }) });
    await expect(firstRow.getByRole("cell", { name: "1", exact: true })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Loading page 2" })).toBeVisible();
    await page.getByRole("button", { name: "Go to next page", exact: true }).click();
    gate.resolve();
    const response = await finalPage;
    expect(response.request().postDataJSON().params.page.cursor).toBeUndefined();
    expect((await response.json()).outcome.value.rows[0].values.title).toBe("paged-owner-0 row 0200");
    await expect(page.getByRole("cell", { name: "paged-owner-0 row 0200", exact: true })).toBeVisible();
  } finally {
    gate.resolve();
    await page.unroute("**/commands/*/execute");
  }

  const boardResult = nextResult(0, "board");
  const readiness = await observeCollectionReadiness(page, "board", 0);
  await page.getByRole("option", { name: "paged-owner-0 board", exact: true }).click();
  const elapsedMs = await readiness();
  const response = await boardResult;
  const board = await response.json();
  expect(board.outcome.value.rows).toHaveLength(100);
  expect(board.outcome.value.page.groups).toEqual([
    { field: "status", value: "done", count: 125 },
    { field: "status", value: "todo", count: 125 },
  ]);
  await expect(page.getByText("paged-owner-0 row 0001", { exact: true })).toBeVisible();
  evidence.push({ view: "owner-0-board", elapsedMs, rows: 100, responseBytes: JSON.stringify(board).length });
  const renderer = page.getByTestId("kanban-renderer");
  await expect(renderer.getByText("125", { exact: true })).toHaveCount(2);
  expect(board.outcome.value.rows[0].title).toBe("paged-owner-0 row 0001");
  expect(board.outcome.value.rows[99].title).toBe("paged-owner-0 row 0199");
  await recordEvidence(evidence);
  const emptyColumn = page.getByTestId("board-column-todo");
  await expect(emptyColumn.getByText(/hidden by search/)).toHaveCount(0);
  const load = emptyColumn.getByRole("button", { name: "Load more cards" });
  await expect(load).toBeVisible();
  await expect(load).toBeEnabled();
  const keyboardPage = nextResult(0, "board", 100);
  await load.press("Enter");
  expect((await (await keyboardPage).json()).outcome.value.rows[0].title).toBe("paged-owner-0 row 0201");
  await expect(emptyColumn.getByText("paged-owner-0 row 0000", { exact: true })).toBeVisible();
  const more = nextResult(0, "board", 200);
  const viewport = renderer.locator("[data-board-column-viewport]").first();
  await viewport.hover();
  await page.mouse.wheel(0, 10000);
  expect((await (await more).json()).outcome.value.rows[0].title).toBe("paged-owner-0 row 0150");
  await exerciseSelectionAndSearch(page, expectedSelection);
  await page.getByRole("button", { name: "Go to next page", exact: true }).click();
  await expect(page.getByRole("cell", { name: "paged-owner-0 row 0100", exact: true })).toBeVisible();
  try {
    await moveFirstRow(300);
    await expect(page.getByRole("cell", { name: "paged-owner-0 row 0001", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "paged-owner-0 row 0000", exact: true })).toHaveCount(0);
  } finally {
    await moveFirstRow(0);
  }
  await exerciseGroupedPageSelection(page);
  for (const body of await Promise.all(commandBodies)) expect(body).not.toContain("OFF_PAGE_BODY");
  return evidence;
};

const exerciseSelectionAndSearch = async (page: Page, expectedIds: string[]) => {
  await page.getByRole("option", { name: "paged-owner-0 table", exact: true }).click();
  const first = page.getByRole("button", { name: "Go to first page", exact: true });
  if (await first.isEnabled()) await first.click();
  await expect(page.getByRole("cell", { name: "paged-owner-0 row 0000", exact: true })).toBeVisible();
  await page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "paged-owner-0 row 0000", exact: true }) })
    .getByLabel("Select row", { exact: true })
    .click();
  await page.getByRole("button", { name: "Go to next page", exact: true }).click();
  await expect(page.getByRole("cell", { name: "paged-owner-0 row 0100", exact: true })).toBeVisible();
  await page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "paged-owner-0 row 0100", exact: true }) })
    .getByLabel("Select row", { exact: true })
    .click();
  await expect(page.getByText("2 rows selected", { exact: true })).toBeVisible();
  const selected = page.waitForResponse((response) =>
    response.url().endsWith("example.paged-owner-0.command.selection/execute"),
  );
  await page.getByRole("button", { name: "Use selected rows", exact: true }).click();
  const ids = (await (await selected).json()).outcome.value as string[];
  expect(ids).toHaveLength(2);
  expect(new Set(ids)).toEqual(new Set(expectedIds));
  await page.getByRole("button", { name: "Search this view", exact: true }).click();
  await page.getByRole("textbox", { name: "Search this view", exact: true }).fill("row 024");
  await expect(page.getByRole("cell", { name: /^paged-owner-0 row / })).toHaveCount(10);
  await expect(page.getByText("10 of 250", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Search this view", exact: true }).fill(" 124 ");
  await expect(page.getByRole("cell", { name: /^paged-owner-0 row / })).toHaveCount(3);
  for (const ordinal of [124, 248, 249])
    await expect(
      page.getByRole("cell", { name: `paged-owner-0 row ${String(ordinal).padStart(4, "0")}`, exact: true }),
    ).toBeVisible();
  await expect(page.getByText("3 of 250", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Search this view", exact: true }).fill("not present");
  await expect(page.getByRole("cell", { name: /^paged-owner-0 row / })).toHaveCount(0);
  await expect(page.getByText("0 of 250", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close search", exact: true }).click();
  await expect(page.getByRole("cell", { name: "paged-owner-0 row 0000", exact: true })).toBeVisible();
};
