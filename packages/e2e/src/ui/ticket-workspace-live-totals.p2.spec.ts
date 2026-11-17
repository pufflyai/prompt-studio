import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket } from "../helpers/planner-api";
import { uiOrigin } from "../ui-server";
import { prepareDashboard } from "./helpers/workspace-files";
import { createGitRepo } from "./helpers/workspace-session-attempt";

// Critical risk: a visible ticket tree must follow external Git/file changes without a workspace-row mutation.
test("ticket workspace totals stay live without rereading the tree command", async ({ page, request }) => {
  const root = createGitRepo("pstdio-live-ticket-diff-", "Live workspace totals");
  writeFileSync(join(root, ".gitignore"), ".pstdio/\n.opencode/\n.agents/\n.claude/\n");
  execFileSync("git", ["add", ".gitignore"], { cwd: root });
  execFileSync("git", ["commit", "-m", "Ignore project metadata"], { cwd: root, stdio: "pipe" });
  let projectId: string | undefined;
  const retryEntered = Promise.withResolvers<void>();
  const releaseRetry = Promise.withResolvers<void>();
  try {
    const created = await request.post(`${uiOrigin}/v1/projects`, {
      data: folderProjectInput({ name: "Live ticket workspace totals" }, root),
    });
    expect(created.ok()).toBe(true);
    projectId = (await created.json()).id;
    const ticket = await createPlannerTicket(request, uiOrigin, projectId!, { content: "# Live ticket totals" });
    const linked = await request.post(`${uiOrigin}/v1/workspaces`, {
      data: {
        project_id: projectId,
        provider_id: "pstdio.worktree",
        params: {},
        anchors: [{ type: "ticket", id: ticket.id, projectId, extensionId: "pstdio.pstdio-planner" }],
      },
    });
    expect(linked.ok(), await linked.text()).toBe(true);
    const workspace = await linked.json();
    const summaryRoute = `**/v1/workspaces/${workspace.id}/diff-summary*`;
    writeFileSync(join(workspace.root_path, "external.txt"), "first\n");
    await prepareDashboard(page, projectId!);
    const treeCommands: string[] = [];
    page.on("request", (entry) => {
      if (entry.method() === "POST" && /\/extensions\/commands\/.*tree/.test(entry.url()))
        treeCommands.push(entry.url());
    });
    await page.route(summaryRoute, (route) =>
      route.fulfill({ status: 503, json: { error: { message: "Unavailable" } } }),
    );
    await page.goto(`/projects/${projectId}/extensions/pstdio.pstdio-planner/tickets`);
    await page.getByTestId("renderer-card").getByText("Live ticket totals", { exact: true }).click();
    const sidenav = page.locator('[data-workbench-region="sidenav"]');
    const row = sidenav.getByRole("option").filter({ hasText: workspace.workspace_shorthand });
    await expect(row).toBeVisible();
    const initialRetry = row.getByRole("button", { name: "Retry workspace changes", exact: true });
    await expect(initialRetry).toBeVisible();
    const resourceUrl = page.url();
    await page.unroute(summaryRoute);
    await page.route(summaryRoute, async (route) => {
      retryEntered.resolve();
      await releaseRetry.promise;
      await route.continue();
    });
    await initialRetry.click();
    await retryEntered.promise;
    await expect(initialRetry).toBeDisabled();
    await expect(row.getByLabel("Loading workspace changes")).toBeVisible();
    releaseRetry.resolve();
    await expect(row.getByText("+1", { exact: true })).toBeVisible();
    await page.unroute(summaryRoute);
    expect(page.url()).toBe(resourceUrl);
    // Let the initial finite reads and Darwin's bounded watch reconciliation finish before the external edit.
    await page.waitForTimeout(500);
    const commandsBeforeEdit = [...treeCommands];
    const workspaceUrl = `${uiOrigin}/v1/workspaces?project_id=${projectId}`;
    const workspaceBeforeEdit = await (await request.get(workspaceUrl)).json();
    writeFileSync(join(workspace.root_path, "external.txt"), "first\nsecond\n");
    await expect(row.getByText("+2", { exact: true })).toBeVisible();
    await page.route(summaryRoute, (route) =>
      route.fulfill({ status: 503, json: { error: { message: "Unavailable" } } }),
    );
    writeFileSync(join(workspace.root_path, "external.txt"), "first\nsecond\nthird\n");
    const retry = row.getByRole("button", { name: "Retry workspace changes", exact: true });
    await expect(retry).toBeVisible();
    await expect(row.getByText("+2", { exact: true })).toBeVisible();
    await page.unroute(summaryRoute);
    await retry.click();
    await expect(row.getByText("+3", { exact: true })).toBeVisible();
    await expect(retry).toHaveCount(0);
    expect(page.url()).toBe(resourceUrl);
    expect(treeCommands).toEqual(commandsBeforeEdit);
    expect(await (await request.get(workspaceUrl)).json()).toEqual(workspaceBeforeEdit);
  } finally {
    releaseRetry.resolve();
    if (projectId) await request.delete(`${uiOrigin}/v1/projects/${projectId}`);
    rmSync(root, { recursive: true, force: true });
  }
});
