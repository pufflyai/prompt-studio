import { rmSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { defaultPageResourceCodec } from "@pstdio/sdk/extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";
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
    const board = `/projects/${projectId}/extensions/pstdio.pstdio-planner/tickets`;
    await page.goto(board);
    const card = page.getByTestId("renderer-card").filter({ hasText: "Linked resource navigation" });
    await card.getByRole("button", { name: `pstdio · ${session.title}`, exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      (url) => defaultPageResourceCodec.fromUri(url.searchParams.get("resource") ?? "")?.id === attempt.session.id,
    );
    expect(defaultPageResourceCodec.fromUri(new URL(page.url()).searchParams.get("resource")!)).toMatchObject({
      type: "session",
      id: attempt.session.id,
      extensionId: "pstdio",
      projectId,
    });

    await page.goto(board);
    const removed = await request.delete(`${uiOrigin}/v1/sessions/${attempt.session.id}`);
    expect(removed.ok()).toBe(true);
    await expect(card.getByTestId("collection-badge")).toHaveCount(1);
    await card.getByRole("button", { name: `pstdio · ${attempt.workspace.workspace_shorthand}`, exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText(
      attempt.workspace.workspace_shorthand,
    );
    await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText(ticket.shorthand);
  } finally {
    if (projectId) await request.delete(`${uiOrigin}/v1/projects/${projectId}`);
    rmSync(folder, { recursive: true, force: true });
  }
});
