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

const useDesktopTabs = async (page: Page, ids: string[], failStartup = false) => {
  await page.addInitScript(
    ({ ids, failStartup }) => {
      if (window.top !== window) return;
      Object.assign(window, {
        promptStudioDesktop: {
          getAppInfo: async () => ({ platform: "darwin" }),
          getProjectTabs: async () => ({ projectIds: ids }),
          setProjectTabs: async () => undefined,
          getWorkbenchState: async () => {
            if (failStartup) throw new Error("Fixture rejected the saved layout read");
            return { values: {} };
          },
          setWorkbenchItem: async () => undefined,
        },
      });
    },
    { ids, failStartup },
  );
};

// Critical risk: a project render failure must leave the other tabs and their workbench usable.
test("keeps the desktop tab bar usable after a project throws and retries only that project", async ({
  page,
  request,
}) => {
  const healthy = await createProject(request, "Healthy project");
  const failing = await createProject(request, "Failing project");
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

test("offers a window reload when dashboard startup rejects before mounting React", async ({ page }) => {
  await useDesktopTabs(page, [], true);
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Prompt Studio couldn’t open");
  await expect(page.getByRole("link", { name: "Reload Prompt Studio" })).toBeVisible();
});
