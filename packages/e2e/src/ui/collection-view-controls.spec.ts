import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";

const ticketsBoard = "pstdio.pstdio-planner.view.tickets";
const artifactsTable = "pstdio.workbench-fixture.view.artifacts";

interface BoardField {
  id: string;
  kind: string;
  conditions: string[];
  options?: { value: string; label: string }[];
}

const createProject = async (request: APIRequestContext, page: Page, name: string) => {
  const response = await request.post("/v1/projects", { data: folderProjectInput({ name }) });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);
  return { id: project.id, origin: new URL(response.url()).origin };
};

const execute = async (request: APIRequestContext, projectId: string, commandId: string, params: object) => {
  const result = await request.post(`/v1/projects/${projectId}/extensions/commands/${commandId}/execute`, {
    data: { params },
  });
  expect(result.ok(), await result.text()).toBe(true);
};

const views = (origin: string, ...args: string[]) =>
  spawnSync(
    "bun",
    ["--conditions=source", resolve(import.meta.dirname, "../../../pstdio/src/index.ts"), "views", ...args],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PSTDIO_DISABLE_EMBED_MANIFEST: "1",
        PSTDIO_HOME: process.env.E2E_HOME,
        PSTDIO_API_URL: origin,
      },
    },
  );

test("boards search, edit filter parts, and save one sort that agents can build too", async ({ page, request }) => {
  const project = await createProject(request, page, "Collection view controls");
  try {
    for (const title of ["Filter pills read as sentences", "Saved filters for views", "Chat scroll jumps"])
      await execute(request, project.id, "pstdio.pstdio-planner.command.create-ticket", {
        title,
        content: `# ${title}`,
      });
    const board = (await (await request.get(`/v1/projects/${project.id}/boards/${ticketsBoard}`)).json()) as {
      kind: string;
      fields: BoardField[];
    };
    expect(board.kind).toBe("kanban");
    const status = board.fields.find((field) => field.id === "status")!;
    expect(status.conditions).toContain("is-none-of");
    await page.goto(`/projects/${project.id}/extensions/pstdio.pstdio-planner/tickets`);
    const cards = page.getByTestId("renderer-card");
    await expect(cards).toHaveCount(3);

    // Search narrows and marks the cards, and never marks the view as changed.
    await page.getByRole("button", { name: "Search this view" }).click();
    await page.getByRole("textbox", { name: "Search this view" }).fill("filter");
    await expect(cards).toHaveCount(2);
    await expect(page.locator("mark").first()).toHaveText(/filter/i);
    await expect(page.getByLabel("Unsaved view changes")).toHaveCount(0);
    await page.getByRole("textbox", { name: "Search this view" }).press("Escape");
    await expect(cards).toHaveCount(3);

    // A quick rule, then its condition changed from its pill.
    const statusLabel = status.options![0]!.label;
    await page.getByRole("button", { name: "Add filter", exact: true }).click();
    await page
      .getByTestId("filter-property-column")
      .getByRole("button", { name: /Status/ })
      .click();
    await page.getByRole("checkbox", { name: statusLabel, exact: true }).click();
    await page.keyboard.press("Escape");
    const statusFilter = page.getByRole("group", { name: "Status filter", exact: true });
    await statusFilter.getByRole("button", { name: "Condition", exact: true }).click();
    await page.getByRole("menuitem", { name: "is not", exact: true }).click();
    await expect(statusFilter.getByRole("button", { name: "Condition" })).toHaveText("is not");
    await expect(statusFilter.getByRole("button", { name: "Values" })).toHaveText(statusLabel);
    await page.keyboard.press("Escape");
    await expect(page.getByText("Nothing matches this view")).toBeVisible();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(cards).toHaveCount(3);

    // Display owns the one ordering, including the deprecated created-desc default.
    await page.getByRole("button", { name: "Display settings" }).click();
    await expect(page.getByRole("button", { name: "Ordering", exact: true })).toHaveText(/Created/);
    await page.getByRole("button", { name: "Ordering", exact: true }).click();
    await page.getByRole("menuitem", { name: "Title", exact: true }).click();
    await page.getByRole("button", { name: "Sort direction" }).click();
    await page.getByRole("menuitem", { name: "A → Z", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Save as new view", exact: true }).click();
    await expect(page.getByRole("tab", { name: "All copy", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.reload();
    await page.getByRole("button", { name: "Display settings" }).click();
    await expect(page.getByRole("button", { name: "Ordering" })).toHaveText(/Title/);
    await expect(page.getByRole("button", { name: "Sort direction" })).toHaveText("A → Z");
    await page.keyboard.press("Escape");

    // Agents build the same view through pst views, and invalid conditions name the valid ones.
    const statusValue = status.options![0]!.value;
    const created = views(
      project.origin,
      "create",
      "--project-id",
      project.id,
      "--board",
      ticketsBoard,
      "--title",
      "Agent open",
      "--filter",
      `status is-none-of ${statusValue}`,
      "--sort",
      "created:desc",
    );
    expect(created.status, created.stderr).toBe(0);
    expect(JSON.parse(created.stdout)).toMatchObject({
      filter: { conjunction: "and", rules: [{ attributeId: "status", condition: "is-none-of", value: [statusValue] }] },
      sorts: [{ attributeId: "created", direction: "desc" }],
    });
    await page.getByRole("tab", { name: "Agent open", exact: true }).click();
    await expect(page.getByRole("group", { name: "Status filter", exact: true })).toBeVisible();
    const refused = views(
      project.origin,
      "create",
      "--project-id",
      project.id,
      "--board",
      ticketsBoard,
      "--title",
      "Broken",
      "--filter",
      "title gt 7",
    );
    expect(refused.status).not.toBe(0);
    expect(refused.stderr).toContain("Valid conditions: contains, does-not-contain");
  } finally {
    await request.delete(`/v1/projects/${project.id}`);
  }
});

test("data tables sort from the header and share saved views", async ({ page, request }) => {
  const project = await createProject(request, page, "Table view controls");
  try {
    for (let index = 0; index < 3; index += 1)
      await execute(request, project.id, "pstdio.workbench-fixture.command.glass-lab-artifacts.create", {});
    await page.goto(`/projects/${project.id}`);
    await page.getByRole("option", { name: "Lab mode", exact: true }).click();
    await page.getByRole("tab", { name: "Artifacts", exact: true }).click();
    const header = page.locator('[data-column-id="trustSignal"]').first();
    await header.getByRole("button", { name: "Column options" }).click();
    await page.getByRole("menuitem", { name: "Sort descending" }).click();
    await expect(header.getByRole("button", { name: "Sorted desc" })).toBeVisible();
    const scores = await page.locator('td[data-column-id="trustSignal"]').allInnerTexts();
    expect(scores.map(Number)).toEqual([...scores.map(Number)].sort((left, right) => right - left));

    await page.getByRole("button", { name: "Display settings" }).last().click();
    await page.getByTestId("data-table-display-menu").getByText("Row numbers").click();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-column-id="rowIndex"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Save as new view", exact: true }).click();
    await expect(page.getByRole("tab", { name: "All copy", exact: true })).toHaveAttribute("aria-selected", "true");

    const listed = views(project.origin, "list", "--project-id", project.id, "--board", artifactsTable);
    expect(listed.status, listed.stderr).toBe(0);
    const saved = JSON.parse(listed.stdout).views.find((view: { title: string }) => view.title === "All copy");
    expect(saved).toMatchObject({
      sorts: [{ attributeId: "trustSignal", direction: "desc" }],
      settings: { rowNumbers: false },
    });
  } finally {
    await request.delete(`/v1/projects/${project.id}`);
  }
});
