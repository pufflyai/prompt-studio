import { expect } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin as apiBase } from "../ui-server";
import { test } from "./helpers/notification-settings";

test.use({ notificationsEnabled: true });

const navSwitchProjectButton = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: "Nav Chrome" }).getByRole("button", { name: "Switch project", exact: true });

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  const projects = (await res.json()) as { id: string }[];
  for (const project of projects) {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
  }
};

const createProjectViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  name: string,
  folderPath?: string,
) => {
  const res = await request.post(`${apiBase}/v1/projects`, { data: folderProjectInput({ name }, folderPath) });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string };
};

test("dashboard keeps project selection open when no project is selected", async ({ page, request }) => {
  test.setTimeout(20_000);
  await deleteAllProjects(request);

  await page.goto("/");

  const projectPicker = page.getByRole("dialog").filter({ hasText: "No projects yet" });
  await expect(projectPicker).toBeVisible();
  await expect(projectPicker.getByRole("button", { name: "Close Projects" })).toHaveCount(0);
  for (const control of await page.locator('#root button:not([role="dialog"] *)').all()) {
    await expect(control).toBeHidden();
  }
  await expect(page.getByRole("option", { name: "Search", exact: true })).toHaveCount(0);
  await expect(page.getByRole("option", { name: "Notifications", exact: true })).toHaveCount(0);
  await expect(page.locator('[data-workbench-region="sidenav"]')).toBeHidden();
  await expect(page.locator('[data-workbench-region="activity"]')).toBeHidden();
  await expect(page.locator('[data-workbench-region="status"]')).toBeHidden();

  await projectPicker.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("option", { name: "Appearance", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Close/ }).click();
  await expect(projectPicker).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(projectPicker).toBeVisible();

  await page.evaluate(() => {
    const dashboardWindow = window as unknown as {
      __pstdioDashboardWorkbench?: {
        layout: {
          getLayout(): { regions: { overlay: { widgets: { viewId?: string; widgetId: string }[] } } };
          removeWidgetPlacement(widgetId: string): void;
        };
      };
    };
    const workbench = dashboardWindow.__pstdioDashboardWorkbench;
    const placement = workbench?.layout
      .getLayout()
      .regions.overlay.widgets.find((widget) => widget.viewId === "dashboard-workbench.project-picker");
    if (!workbench || !placement) throw new Error("Project picker is not open");
    workbench.layout.removeWidgetPlacement(placement.widgetId);
  });
  await expect(projectPicker).not.toBeVisible();

  await page.reload();
  await expect(projectPicker).toBeVisible();

  const folder = folderProjectInput({}).initial_workspace.params.path;
  await projectPicker.getByRole("button", { name: "Create project", exact: true }).click();
  const path = page.getByRole("textbox", { name: "Folder path", exact: true });
  await path.fill(folder);
  await path.press("Enter");
  await page.getByRole("button", { name: "Open folder", exact: true }).click();
  await page.getByRole("dialog", { name: "Open project folder", exact: true }).waitFor({ state: "hidden" });
  await expect(page.getByRole("option", { name: "Home", exact: true })).toBeVisible();
  await expect(page.getByTestId("start-page")).toBeVisible();
});

test("dashboard selects the only project on first load", async ({ page, request }) => {
  test.setTimeout(20_000);
  await deleteAllProjects(request);
  await createProjectViaApi(request, "Single Project Start Test");

  await page.goto("/");

  await expect(page.getByLabel("Main").getByTestId("start-page")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("dashboard-wb2:selected-project:global")))
    .toBeTruthy();
});

test("switching projects never reopens the picker while restoring the landing view", async ({ page, request }) => {
  await deleteAllProjects(request);
  const firstProject = await createProjectViaApi(request, "First Switch Project");
  const secondProject = await createProjectViaApi(request, "Second Switch Project");
  await page.addInitScript((projectId) => {
    window.localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, firstProject.id);

  await page.goto("/");
  await expect(page.getByLabel("Main").getByTestId("start-page")).toBeVisible();
  await navSwitchProjectButton(page).click();

  const picker = page.getByRole("dialog", { name: "Projects", exact: true });
  await expect(picker).toBeVisible();
  await page.evaluate(() => {
    const dashboardWindow = window as unknown as {
      __projectPickerOpenedAfterSelection?: boolean;
      __pstdioDashboardWorkbench?: {
        overlays: {
          openOverlay: (id: string, input?: unknown) => unknown;
        };
      };
    };
    const overlays = dashboardWindow.__pstdioDashboardWorkbench?.overlays;
    if (!overlays) throw new Error("Dashboard workbench is not available");
    const openOverlay = overlays.openOverlay.bind(overlays);
    dashboardWindow.__projectPickerOpenedAfterSelection = false;
    overlays.openOverlay = (id, input) => {
      if (id === "dashboard-workbench.project-picker") {
        dashboardWindow.__projectPickerOpenedAfterSelection = true;
      }
      return openOverlay(id, input);
    };
  });

  await picker.getByText(secondProject.name, { exact: true }).click();

  await expect(picker).not.toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("dashboard-wb2:selected-project:global")))
    .toBe(secondProject.id);
  await expect(page.getByLabel("Main").getByTestId("start-page")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __projectPickerOpenedAfterSelection?: boolean }).__projectPickerOpenedAfterSelection,
    ),
  ).toBe(false);
});
