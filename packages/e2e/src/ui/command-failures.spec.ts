import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { createPlannerTicket } from "../helpers/planner-api";
import { uiOrigin as apiBase } from "../ui-server";
import { createResourceActionsProject, prepareResourceActionsDashboard } from "./helpers/resource-actions";

const fixtures: { projectId: string; folder: string }[] = [];
const createProject = async (request: APIRequestContext) => {
  const tempRoot = resolve(import.meta.dirname, "../../../../__test-tmp__");
  mkdirSync(tempRoot, { recursive: true });
  const folder = mkdtempSync(resolve(tempRoot, "command-failures-"));
  execFileSync("git", ["init", "-b", "main", folder]);
  writeFileSync(resolve(folder, "README.md"), "Command failure validation\n");
  execFileSync("git", ["-C", folder, "add", "."]);
  execFileSync("git", [
    "-C",
    folder,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-qm",
    "initial",
  ]);
  const project = await createResourceActionsProject(request, folder);
  fixtures.push({ projectId: project.id, folder });
  return project;
};
test.afterEach(async ({ request }) => {
  for (const fixture of fixtures.splice(0)) {
    await request.delete(`${apiBase}/v1/projects/${fixture.projectId}`);
    rmSync(fixture.folder, { recursive: true, force: true });
  }
});

const failure = "The command could not connect.";
const archiveCommand = "pstdio.pstdio-planner.command.archive-ticket";

const failCommand = async (page: Page, commandId: string, transport = false) => {
  await page.route(`**/extensions/commands/${commandId}/execute`, (route) =>
    route.fulfill({
      status: transport ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        transport
          ? { message: failure }
          : {
              commandId,
              extensionId: "pstdio.pstdio-planner",
              outcome: { ok: false, status: "error", reason: failure, error: { message: failure }, notices: [] },
            },
      ),
    }),
  );
};

const openBoard = async (page: Page, projectId: string) => {
  await prepareResourceActionsDashboard(page, projectId);
  await page.goto(`/projects/${projectId}/tickets`);
  await page
    .locator('[data-workbench-region="sidenav"]')
    .getByRole("option", { name: "Tickets", exact: true })
    .first()
    .click();
};

for (const transport of [false, true]) {
  test(`a failing kanban row action produces one report (${transport ? "transport" : "outcome"})`, async ({
    page,
    request,
  }) => {
    const project = await createProject(request);
    const ticket = await createPlannerTicket(request, apiBase, project.id, { content: "# Failed row action" });
    await failCommand(page, archiveCommand, transport);
    await openBoard(page, project.id);
    const card = page.getByTestId("renderer-card").filter({ hasText: ticket.title }).first();
    await card.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Archive", exact: true }).click();
    await expect(page.getByText("Archive failed", { exact: true })).toHaveCount(1);
    await expect(page.getByText("Extension command failed", { exact: true })).toHaveCount(0);
    await expect(card).toBeVisible();
    await test.info().attach("failure-report", {
      path: await page
        .screenshot({ path: test.info().outputPath("failure-report.png") })
        .then(() => test.info().outputPath("failure-report.png")),
      contentType: "image/png",
    });
  });
}

test("a failing keybinding produces one report", async ({ page, request }) => {
  const project = await createProject(request);
  const ticket = await createPlannerTicket(request, apiBase, project.id, { content: "# Failed keybinding" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/extensions/ui", async (route) => {
    const response = await route.fetch();
    const metadata = await response.json();
    metadata.keybindings = [
      ...(metadata.keybindings ?? []),
      {
        id: "failure-report",
        extensionId: "pstdio.pstdio-planner",
        key: "Ctrl+Shift+Y",
        canonicalChord: "Ctrl+Shift+Y",
        parsed: { key: "Y", ctrl: true, shift: true, alt: false, meta: false, modifiers: ["Control", "Shift"] },
        action: {
          kind: "command",
          target: {
            command: { kind: "command", extensionId: "pstdio.pstdio-planner", id: "archive-ticket" },
            params: { ticketId: ticket.id },
          },
        },
      },
    ];
    await route.fulfill({ response, json: metadata });
  });
  await failCommand(page, archiveCommand);
  await openBoard(page, project.id);
  await expect(page.getByTestId("renderer-card").filter({ hasText: ticket.title })).toBeVisible();
  await page.keyboard.press("Control+Shift+Y");
  await expect(page.getByText("Archive ticket failed", { exact: true })).toHaveCount(1);
  await expect(page.getByText(failure, { exact: true })).toHaveCount(1);
  expect(errors).toEqual([]);
  await test.info().attach("failure-report", {
    path: await page
      .screenshot({ path: test.info().outputPath("failure-report.png") })
      .then(() => test.info().outputPath("failure-report.png")),
    contentType: "image/png",
  });
});

test("a failing Run attempt is reported only in its dialog", async ({ page, request }) => {
  const project = await createProject(request);
  const ticket = await createPlannerTicket(request, apiBase, project.id, { content: "# Failed attempt" });
  await failCommand(page, "pstdio.pstdio-planner.command.run-attempt");
  await openBoard(page, project.id);
  await page.getByTestId("renderer-card").filter({ hasText: ticket.title }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Run attempt", exact: true }).click();
  const dialog = page.getByRole("dialog").filter({ has: page.getByText("Run attempt", { exact: true }) });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Run", exact: true }).click();
  await expect(dialog.getByText(failure, { exact: true })).toBeVisible();
  await expect(page.getByText(failure, { exact: true })).toHaveCount(1);
  await test.info().attach("failure-report", {
    path: await page
      .screenshot({ path: test.info().outputPath("failure-report.png") })
      .then(() => test.info().outputPath("failure-report.png")),
    contentType: "image/png",
  });
});
