import { fakeHarnessId } from "../helpers/session-side-panel";
import { expect, test } from "../scripts/session-test";
import { createResourceActionsProject, prepareResourceActionsDashboard } from "./helpers/resource-actions";

test("dragging into Pinned saves sessions across reloads", async ({ page, request }) => {
  const project = await createResourceActionsProject(request);
  const first = "Research to pin";
  const second = "Planning to pin";
  for (const title of [first, second]) {
    const response = await request.post("/v1/sessions", {
      data: { project_id: project.id, title, prompt: "", agent: fakeHarnessId },
    });
    expect(response.ok()).toBe(true);
  }
  await prepareResourceActionsDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/extensions/pstdio.session-browser/conversations`);
  const nav = page.locator('[data-workbench-region="sidenav"]');
  const row = (title: string) => nav.getByRole("option", { name: title, exact: true });
  const menuItem = (name: string) =>
    page.locator("[role=menu][data-state=open]").getByRole("menuitem", { name, exact: true });
  await expect(row(first)).toBeVisible();
  await row(first).click();
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText(first);
  const openSessionUrl = page.url();

  const drag = async (source: string, target: string) => {
    const from = (await row(source).boundingBox())!;
    const to = (await row(target).boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
    await page.mouse.up();
  };

  const openRowMenu = async (title: string) => {
    await row(title).click({ button: "right" });
  };
  const expectPinAction = (title: string, action: "Pin session" | "Unpin session") =>
    expect
      .poll(async () => {
        await openRowMenu(title);
        const visible = await menuItem(action).isVisible();
        await page.keyboard.press("Escape");
        return visible;
      })
      .toBe(true);

  await expect(row("Drop a session here")).toBeVisible();
  await drag(first, "Drop a session here");
  await expectPinAction(first, "Unpin session");
  await drag(second, first);
  await expectPinAction(second, "Unpin session");
  await expect(page).toHaveURL(openSessionUrl);
  await page.reload();
  await expectPinAction(first, "Unpin session");
  await openRowMenu(second);
  await menuItem("Unpin session").click();
  await expectPinAction(second, "Pin session");
});
