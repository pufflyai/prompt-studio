import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import {
  createResourceActionsProject,
  openSessionSidePanel,
  prepareResourceActionsDashboard,
} from "./helpers/resource-actions";

const createSession = async (request: APIRequestContext, projectId: string, title: string) => {
  const response = await request.post("/v1/sessions", {
    data: { project_id: projectId, title, prompt: "", agent: "pstdio.workbench-fixture.harness.fake" },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: string; title: string };
};
const row = (page: Page, title: string) =>
  page
    .locator('[data-workbench-region="sidenav"]')
    .getByRole("option", { name: title, exact: true, includeHidden: true });
const menuItem = (page: Page, name: string) =>
  page.locator("[role=menu][data-state=open]").getByRole("menuitem", { name, exact: true });
const breadcrumbMenu = async (page: Page) => page.locator("[data-workbench-breadcrumb-resource-actions]").click();

test("drafts omit management actions and workspace session rows explain guarded deletion", async ({
  page,
  request,
}) => {
  const project = await createResourceActionsProject(request);
  await prepareResourceActionsDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/sessions`);
  await breadcrumbMenu(page);
  await expect(menuItem(page, "Rename session")).toHaveCount(0);
  await expect(menuItem(page, "Delete session")).toHaveCount(0);
  await page.keyboard.press("Escape");
  const session = await createSession(request, project.id, "Waiting for input");
  await request.patch(`/v1/sessions/${session.id}/status`, { data: { status: "awaiting_input" } });
  await row(page, session.title).focus();
  await page.keyboard.press("ContextMenu");
  await expect(
    page.locator("[role=menu][data-state=open]").getByRole("menuitem", { name: /^Delete session/ }),
  ).toHaveAttribute("data-disabled");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Stop active or queued work before deleting.", { exact: true })).toBeFocused();
  await expect(page.getByText("Stop active or queued work before deleting.", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  const [workspace] = await (await request.get(`/v1/workspaces?project_id=${project.id}`)).json();
  const resource = `pstdio://extension-resource/workspace/${workspace.id}`;
  await page.goto(`/projects/${project.id}/workspace?resource=${encodeURIComponent(resource)}`);
  await row(page, session.title).click({ button: "right" });
  await expect(menuItem(page, "Rename session")).toBeVisible();
  await expect(menuItem(page, "Archive session")).toBeVisible();
  await expect(
    page.locator("[role=menu][data-state=open]").getByRole("menuitem", { name: /^Delete session/ }),
  ).toHaveAttribute("data-disabled");
  await menuItem(page, "Archive session").click();
  await expect(page.getByRole("dialog")).toContainText("will continue");
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(row(page, session.title)).toBeHidden();
  expect(await (await request.get(`/v1/sessions/${session.id}`)).json()).toMatchObject({
    archived: true,
    status: "awaiting_input",
  });
  await expect(page).toHaveURL(new RegExp(workspace.id));
});

test("shared session actions rename another row without changing the selected session", async ({ page, request }) => {
  const project = await createResourceActionsProject(request);
  const a = await createSession(request, project.id, "Open conversation");
  await createSession(request, project.id, "Other conversation");
  await prepareResourceActionsDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/sessions`);
  await row(page, a.title).click();
  await breadcrumbMenu(page);
  for (const name of ["Rename session", "Archive session", "Delete session", "Copy link"])
    await expect(page.getByRole("menuitem", { name, exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await row(page, "Other conversation").focus();
  await page.keyboard.press("Shift+F10");
  await menuItem(page, "Rename session").click();
  const input = page.getByRole("textbox", { name: "Session name" });
  await expect(input).toHaveValue("Other conversation");
  await input.fill("  ");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Enter a session name");
  await input.fill("  Renamed conversation  ");
  await page.route("**/v1/sessions/*/title", (route) =>
    route.fulfill({ status: 503, json: { error: "Save unavailable. Try again." } }),
  );
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Save unavailable");
  await expect(input).toHaveValue("  Renamed conversation  ");
  await expect(row(page, "Other conversation")).toBeVisible();
  await page.unroute("**/v1/sessions/*/title");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(row(page, "Renamed conversation")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(a.id));
  await row(page, "Renamed conversation").click();
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Renamed conversation");
  await page.reload();
  await expect(row(page, "Renamed conversation")).toBeVisible();
});

test("archive keeps saved data, preserves a different page, and rolls back failed saves", async ({ page, request }) => {
  const project = await createResourceActionsProject(request);
  const a = await createSession(request, project.id, "Keep open");
  const b = await createSession(request, project.id, "Archive this");
  await prepareResourceActionsDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/sessions`);
  await row(page, a.title).click();
  await row(page, b.title).click({ button: "right" });
  await menuItem(page, "Archive session").click();
  await expect(page.getByRole("dialog")).toContainText("saved conversation is kept");
  await page.keyboard.press("Escape");
  await expect(row(page, b.title)).toBeVisible();
  await row(page, b.title).click({ button: "right" });
  await menuItem(page, "Archive session").click();
  await page.route("**/v1/sessions/*/archive", (route) =>
    route.fulfill({ status: 503, json: { error: "Archive unavailable. Try again." } }),
  );
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Archive unavailable");
  await expect(row(page, b.title)).toBeVisible();
  await page.unroute("**/v1/sessions/*/archive");
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(row(page, b.title)).toBeHidden();
  await expect(page).toHaveURL(new RegExp(a.id));
  expect(await (await request.get(`/v1/sessions/${b.id}`)).json()).toMatchObject({ archived: true });
  await breadcrumbMenu(page);
  await menuItem(page, "Archive session").click();
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/sessions/compose$`));
  await expect(page.getByText("No sessions yet", { exact: true })).toBeVisible();
});

test("delete confirms, keeps a failed session usable, closes only its views, and survives reload", async ({
  page,
  request,
}) => {
  const project = await createResourceActionsProject(request);
  const a = await createSession(request, project.id, "Keep panel");
  const b = await createSession(request, project.id, "Delete this");
  await prepareResourceActionsDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/sessions`);
  await openSessionSidePanel(page, a.title);
  const kept = page.locator('[data-workbench-panel-header="side"]').getByRole("tab", { name: /Keep panel/ });
  await expect(kept).toBeVisible();
  await row(page, b.title).click();
  await expect(kept).toBeVisible();
  await breadcrumbMenu(page);
  await menuItem(page, "Delete session").click();
  await expect(page.getByRole("dialog")).toContainText("Delete this");
  await expect(page.getByRole("dialog")).toContainText("external agent history are kept");
  await page.keyboard.press("Escape");
  await expect(row(page, b.title)).toBeVisible();
  await breadcrumbMenu(page);
  await menuItem(page, "Delete session").click();
  await page.route("**/v1/sessions/*", async (route) => {
    if (route.request().method() === "DELETE")
      await route.fulfill({ status: 503, json: { error: "Delete unavailable. Try again." } });
    else await route.continue();
  });
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Delete unavailable");
  await expect(row(page, b.title)).toBeVisible();
  await page.unroute("**/v1/sessions/*");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(row(page, b.title)).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/sessions/compose$`));
  await expect(kept).toBeVisible();
  expect((await request.get(`/v1/sessions/${b.id}`)).status()).toBe(404);
  await page.reload();
  await expect(row(page, b.title)).toBeHidden();
  await expect(row(page, a.title)).toBeVisible();
});
