import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import type { WorkbenchCore } from "@pstdio/workbench";
import { folderProjectInput } from "../helpers/folder-project";

type Project = { id: string; name: string };
type DashboardWindow = Window & {
  __pstdioDashboardWorkbench: WorkbenchCore;
  healthyWorkbench?: WorkbenchCore;
  failProjectRender?: boolean;
};

const createProject = async (request: APIRequestContext, name: string): Promise<Project> => {
  const response = await request.post("/v1/projects", { data: folderProjectInput({ name }) });
  expect(response.ok()).toBe(true);
  return response.json();
};

const useDesktopTabs = async (page: Page, ids: string[]) => {
  await page.addInitScript(
    ({ ids }) => {
      if (window.top !== window) return;
      Object.assign(window, {
        promptStudioDesktop: {
          getAppInfo: async () => ({ platform: "darwin" }),
          getProjectTabs: async () => ({ projectIds: ids }),
          setProjectTabs: async () => undefined,
          getWorkbenchState: async () => ({ values: {} }),
          setWorkbenchItem: async () => undefined,
        },
      });
    },
    { ids },
  );
};

test.describe("project tab recovery", () => {
  let healthy: Project;
  let failing: Project;

  test.beforeAll(async ({ request }) => {
    // Each folder has independent setup. Prepare both before timing the tab interactions.
    [healthy, failing] = await Promise.all([
      createProject(request, "Healthy project"),
      createProject(request, "Failing project"),
    ]);
  });

  // Critical risk: a project render failure must leave the other tabs and their workbench usable.
  test("keeps the desktop tab bar usable after a project throws and retries only that project", async ({ page }) => {
    await useDesktopTabs(page, [healthy.id, failing.id]);
    await page.goto(`/projects/${healthy.id}`);
    const tab = (name: string) => page.getByRole("tab", { name, exact: true });
    await expect(tab(healthy.name)).toHaveAttribute("aria-selected", "true");
    await page.evaluate(() => {
      const target = window as DashboardWindow;
      target.healthyWorkbench = target.__pstdioDashboardWorkbench;
    });
    await tab(failing.name).click();
    await expect(tab(failing.name)).toHaveAttribute("aria-selected", "true");
    await page.evaluate(() => {
      const target = window as DashboardWindow;
      const core = target.__pstdioDashboardWorkbench;
      const ref = { kind: "page", extensionId: "test", id: "unstable" } as const;
      core.views.registerView({
        id: "unstable",
        title: "Unstable view",
        body: {
          kind: "react",
          render: ({ visible }) => {
            if (target.failProjectRender && visible) throw new Error("Fixture project render failed");
            return "Project ready for failure";
          },
        },
      });
      core.pages.registerPage({
        id: "unstable",
        ref,
        path: "unstable",
        modeId: "project",
        main: { kind: "view", view: { kind: "view", id: "unstable" }, cardinality: "one" },
        slots: [],
      });
      const result = core.pageLocations.navigate({ kind: "page", page: ref });
      if (!result.ok) throw new Error(result.diagnostic.message);
    });
    await expect(page.getByText("Project ready for failure")).toBeVisible();
    await tab(healthy.name).click();
    await page.evaluate(() => {
      (window as DashboardWindow).failProjectRender = true;
    });
    await tab(failing.name).click();
    const retry = page.getByRole("button", { name: "Retry project" });
    await expect(retry).toBeVisible();
    expect(await page.evaluate(() => (window as DashboardWindow).__pstdioDashboardWorkbench)).toBeUndefined();
    await tab(healthy.name).click();
    await expect(retry).toHaveCount(0);
    expect(
      await page.evaluate(() => {
        const target = window as DashboardWindow;
        return target.healthyWorkbench === target.__pstdioDashboardWorkbench;
      }),
    ).toBe(true);
    await tab(failing.name).click();
    await retry.click();
    await expect(tab(failing.name)).toHaveAttribute("aria-selected", "true");
    await expect(retry).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open / create project" })).toBeVisible();
  });
});
