import type { Route } from "@playwright/test";
import { switchSession } from "../helpers/session-side-panel";
import { expect, test } from "../scripts/session-test";
import { createResourceActionsProject, prepareResourceActionsDashboard } from "./helpers/resource-actions";

// Critical risk: a session opened from a link must still open in only one panel
// before its owner returns the full reference for that link.
test("a linked session moves to Side instead of opening twice before its owner resolves it", async ({
  page,
  request,
}) => {
  const project = await createResourceActionsProject(request);
  const held: Route[] = [];
  try {
    const created = await request.post("/v1/sessions", {
      data: {
        project_id: project.id,
        title: "Linked once",
        prompt: "Linked once",
        agent: "pstdio.workbench-fixture.harness.fake",
      },
    });
    expect(created.ok()).toBe(true);
    const session = await created.json();
    // Hold the owner's answer so Main keeps the reference exactly as the link named it.
    await page.route("**/extensions/commands/pstdio.session-browser.command.resolve/execute", (route) => {
      held.push(route);
    });
    await prepareResourceActionsDashboard(page, project.id);
    await page.goto(
      `/projects/${project.id}/extensions/pstdio.session-browser/conversation?resource=${encodeURIComponent(`pstdio://extension-resource/session/${session.id}`)}`,
    );
    const main = page.locator('[data-workbench-region="main"]');
    const mainComposer = main
      .locator('[data-testid="content-editable"][contenteditable="true"]')
      .filter({ visible: true });
    await expect(mainComposer).toBeVisible();
    await expect.poll(() => held.length).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Open Side Panel", exact: true }).click();
    await page.getByRole("dialog", { name: "Side Panel" }).getByRole("button", { name: "Reattach Side Panel" }).click();
    const header = page.locator('[data-workbench-panel-header="side"]');
    const chooser = page.locator('[data-workbench-panel="side"]').getByRole("group", { name: "Available tabs" });
    await expect(header.getByRole("tab", { selected: true }).or(chooser)).toBeVisible();
    if (await chooser.isVisible()) await chooser.getByRole("button", { name: "New session", exact: true }).click();
    await header.getByRole("tab", { selected: true }).click({ button: "right" });
    await switchSession(page, "Linked once");

    await expect(header.getByRole("tab", { name: "Linked once", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "breadcrumb" }).getByText("Linked once")).toHaveCount(0);
    await expect(mainComposer).toHaveCount(0);
  } finally {
    await Promise.all(held.map((route) => route.continue().catch(() => undefined)));
    await request.delete(`/v1/projects/${project.id}`);
  }
});
