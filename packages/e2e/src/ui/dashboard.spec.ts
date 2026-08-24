import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  const projects = (await res.json()) as { id: string }[];
  for (const project of projects) {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
  }
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, { data: { name } });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string };
};

const createSessionViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  title: string,
) => {
  const res = await request.post(`${apiBase}/v1/sessions`, {
    data: {
      project_id: projectId,
      title,
      prompt: title,
      agent: "pstdio.extension-lab.fake",
    },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; title: string };
};

test("API health check responds ok", async ({ request }) => {
  test.setTimeout(5_000);
  const response = await request.get(`${apiBase}/healthz`);

  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.ok).toBe(true);
});

test("dashboard loads successfully", async ({ page }) => {
  test.setTimeout(5_000);
  await page.goto("/");

  await expect(page.locator("body")).toBeVisible();
  // The dashboard SPA should render without a hard error
  await expect(page.locator("text=Not found")).not.toBeVisible();
});

test("dashboard keeps project selection open when no project is selected", async ({ page, request }) => {
  test.setTimeout(20_000);
  await deleteAllProjects(request);

  await page.goto("/");

  const projectPicker = page.getByRole("dialog").filter({ hasText: "No projects yet" });
  await expect(projectPicker).toBeVisible();
  await expect(projectPicker.getByRole("button", { name: "Close Projects" })).toHaveCount(0);
  await expect(page.locator('button[aria-label="Switch project"]')).toBeVisible();
  await expect(page.getByRole("option", { name: "Search", exact: true })).toHaveCount(0);
  await expect(page.getByRole("option", { name: "Notifications", exact: true })).toHaveCount(0);
  await expect(page.locator('[data-workbench-region="sidenav"]')).toHaveCount(0);
  await expect(page.locator('[data-workbench-region="activity"]')).toHaveCount(0);
  await expect(page.locator('[data-workbench-region="status"]')).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(projectPicker).toBeVisible();

  await page.evaluate(() => {
    const dashboardWindow = window as unknown as {
      __pstdioDashboardWorkbench?: {
        layout: {
          getLayout(): { regions: { overlay: { widgets: { contributionId: string; widgetId: string }[] } } };
          removeWidgetPlacement(widgetId: string): void;
        };
      };
    };
    const workbench = dashboardWindow.__pstdioDashboardWorkbench;
    const placement = workbench?.layout
      .getLayout()
      .regions.overlay.widgets.find((widget) => widget.contributionId === "dashboard-workbench.project-picker");
    if (!workbench || !placement) throw new Error("Project picker is not open");
    workbench.layout.removeWidgetPlacement(placement.widgetId);
  });
  await expect(projectPicker).not.toBeVisible();

  await page.reload();
  await expect(projectPicker).toBeVisible();
});

test("dashboard keeps the project mode and blocks controls behind the project switcher", async ({ page, request }) => {
  test.setTimeout(20_000);
  await deleteAllProjects(request);
  const project = await createProjectViaApi(request, "Overlay Blocking Test");

  await page.addInitScript((selectedProjectId) => {
    window.localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
  }, project.id);
  await page.goto("/");

  const switchProject = page.getByRole("button", { name: "Switch project" });
  const search = page.getByRole("option", { name: "Search", exact: true });
  const notifications = page.getByRole("option", { name: "Notifications", exact: true });
  await expect(switchProject).toBeVisible();
  await expect(search).toBeVisible();
  await expect(notifications).toBeVisible();

  const activeModeBefore = await page.evaluate(() => {
    const dashboardWindow = window as unknown as {
      __pstdioDashboardWorkbench?: { modes: { getActiveModeId(): string | undefined } };
    };
    return dashboardWindow.__pstdioDashboardWorkbench?.modes.getActiveModeId();
  });
  await page.evaluate(() => {
    const dashboardWindow = window as typeof window & { __overlayBackgroundClicks?: Record<string, number> };
    dashboardWindow.__overlayBackgroundClicks = { search: 0, notifications: 0 };
  });
  await search.evaluate((element) => {
    element.addEventListener("click", () => {
      const dashboardWindow = window as typeof window & { __overlayBackgroundClicks?: Record<string, number> };
      dashboardWindow.__overlayBackgroundClicks!.search += 1;
    });
  });
  await notifications.evaluate((element) => {
    element.addEventListener("click", () => {
      const dashboardWindow = window as typeof window & { __overlayBackgroundClicks?: Record<string, number> };
      dashboardWindow.__overlayBackgroundClicks!.notifications += 1;
    });
  });

  const clickBehindProjectPicker = async (control: typeof search, counter: "search" | "notifications") => {
    const controlBox = await control.boundingBox();
    expect(controlBox).not.toBeNull();
    await switchProject.click();

    const projectPicker = page.getByRole("dialog").filter({ hasText: project.name });
    const positioner = page.locator('[data-scope="dialog"][data-part="positioner"]').filter({ has: projectPicker });
    const backdrop = page.locator('[data-scope="dialog"][data-part="backdrop"]');
    await expect(projectPicker).toBeVisible();
    await expect.poll(() => positioner.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("auto");
    await expect
      .poll(() => backdrop.evaluate((element) => getComputedStyle(element).backgroundColor))
      .not.toBe("rgba(0, 0, 0, 0)");

    await page.mouse.click(controlBox!.x + controlBox!.width / 2, controlBox!.y + controlBox!.height / 2);
    await expect
      .poll(() =>
        page.evaluate((key) => {
          const dashboardWindow = window as typeof window & {
            __overlayBackgroundClicks?: Record<string, number>;
          };
          return dashboardWindow.__overlayBackgroundClicks?.[key];
        }, counter),
      )
      .toBe(0);
    await expect(projectPicker).toBeVisible();
    await projectPicker.getByRole("button", { name: "Close Projects" }).click();
    await expect(projectPicker).not.toBeVisible();
  };

  await clickBehindProjectPicker(search, "search");
  await clickBehindProjectPicker(notifications, "notifications");

  expect(
    await page.evaluate(() => {
      const dashboardWindow = window as unknown as {
        __pstdioDashboardWorkbench?: { modes: { getActiveModeId(): string | undefined } };
      };
      return dashboardWindow.__pstdioDashboardWorkbench?.modes.getActiveModeId();
    }),
  ).toBe(activeModeBefore);
  await search.click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const dashboardWindow = window as typeof window & {
          __overlayBackgroundClicks?: Record<string, number>;
        };
        return dashboardWindow.__overlayBackgroundClicks?.search;
      }),
    )
    .toBe(1);
});

test("dashboard selects the only project on first load", async ({ page, request }) => {
  test.setTimeout(20_000);
  await deleteAllProjects(request);
  await createProjectViaApi(request, "Single Project Start Test");

  await page.goto("/");

  await expect(page.getByLabel("Main").getByText("Recent sessions", { exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("dashboard-wb:selected-project:global")))
    .toBeTruthy();
});

test("dashboard clears a saved project that no longer exists", async ({ page, request }) => {
  test.setTimeout(20_000);
  await deleteAllProjects(request);
  const firstProject = await createProjectViaApi(request, "Current Project");
  const secondProject = await createProjectViaApi(request, "Other Project");

  await page.addInitScript(() => {
    window.localStorage.setItem("dashboard-wb:selected-project:global", "deleted-project");
  });

  await page.goto("/");

  await expect(page.getByText(firstProject.name, { exact: true })).toBeVisible();
  await expect(page.getByText(secondProject.name, { exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("dashboard-wb:selected-project:global")))
    .toBeNull();
});

test("project picker stays open when the background is clicked", async ({ page, request }) => {
  test.setTimeout(20_000);
  await deleteAllProjects(request);
  const firstProject = await createProjectViaApi(request, "First Project");
  await createProjectViaApi(request, "Second Project");
  await page.addInitScript((projectId) => {
    window.localStorage.setItem("dashboard-wb:selected-project:global", projectId);
  }, firstProject.id);

  await page.goto("/");
  await page.getByRole("button", { name: "Switch project" }).click();

  const picker = page.getByRole("dialog").filter({ has: page.getByPlaceholder("Search projects...") });
  await expect(picker).toBeVisible();
  await page.mouse.click(100, 100);

  await expect(picker).toBeVisible();
});

test("dashboard opens the start page for a selected project without a saved location", async ({ page, request }) => {
  test.setTimeout(20_000);
  await deleteAllProjects(request);
  const project = await createProjectViaApi(request, "Dashboard Start Test");
  const session = await createSessionViaApi(request, project.id, "Recent start session");

  await page.addInitScript((selectedProjectId) => {
    window.localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
  }, project.id);

  await page.goto("/");

  await expect(page.getByRole("option", { name: "Start" })).toHaveCount(0);
  await expect(page.getByLabel("Main").getByText("Recent sessions", { exact: true })).toBeVisible();
  await page
    .getByLabel("Main")
    .getByRole("button", { name: /Recent start session/ })
    .click();

  await expect(page.getByLabel("Main").getByText(session.title, { exact: true })).toBeVisible();
  await expect(page.getByLabel("Breadcrumb").getByText(session.title, { exact: true })).toBeVisible();
});
