import { rmSync } from "node:fs";
import { folderProjectInput } from "../helpers/folder-project";
import { expect, test } from "../scripts/session-test";
import { uiOrigin } from "../ui-server";
import { expectResourceMenuItems } from "./helpers/resource-actions";
import { createAttemptWithSessionViaApi, createGitRepo, createTicketViaApi } from "./helpers/workspace-session-attempt";

test("ticket resource badges keep keyboard navigation after a linked session is removed", async ({ page, request }) => {
  const folder = createGitRepo("pstdio-linked-navigation-", "Linked resource navigation");
  let projectId: string | undefined;
  try {
    const created = await request.post(`${uiOrigin}/v1/projects`, { data: folderProjectInput({}, folder) });
    expect(created.ok()).toBe(true);
    projectId = (await created.json()).id;
    const ticket = await createTicketViaApi(request, uiOrigin, projectId!, "Linked resource navigation");
    const attempt = await createAttemptWithSessionViaApi(request, uiOrigin, projectId!, ticket.id, "Run ticket");
    const session = await (await request.get(`${uiOrigin}/v1/sessions/${attempt.session.id}`)).json();
    await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    const board = `/projects/${projectId}/extensions/pstdio.planner/tickets`;
    await page.goto(board);
    const card = page.getByTestId("renderer-card").filter({ hasText: "Linked resource navigation" });
    await card.getByRole("button", { name: `pstdio · ${session.title}`, exact: true }).focus();
    await page.keyboard.press("Enter");
    // Linked resources preview in Side and keep the board in Main.
    const sideTabs = page.locator('[data-workbench-panel-header="side"]');
    await expect(sideTabs.getByRole("tab", { name: session.title, exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page).toHaveURL(new RegExp(`${board}$`));

    await page.goto(board);
    const removed = await request.delete(`${uiOrigin}/v1/sessions/${attempt.session.id}`);
    expect(removed.ok()).toBe(true);
    await expect(card.getByTestId("collection-badge")).toHaveCount(1);
    await card.getByRole("button", { name: `pstdio · ${attempt.workspace.workspace_shorthand}`, exact: true }).focus();
    await page.keyboard.press("Space");
    // A workspace previews its declared Files landing in Side, and that tab carries the workspace actions.
    const workspaceTab = sideTabs.getByRole("tab", { name: "Files", exact: true });
    await expect(workspaceTab).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(new RegExp(`${board}$`));
    await workspaceTab.click({ button: "right" });
    await expectResourceMenuItems(page, ["Open terminal", "Rename workspace", "Delete workspace"]);
    await page.keyboard.press("Escape");
  } finally {
    if (projectId) await request.delete(`${uiOrigin}/v1/projects/${projectId}`);
    rmSync(folder, { recursive: true, force: true });
  }
});
