import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { createPlannerTicket, getPlannerTicketStatuses } from "../helpers/planner-api";
import { startStorybook, storyUrl } from "./mermaid-renderer-storybook";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const breadcrumbStoryId = "pstdio-workbench-onboarding--breadcrumbs";
const documentRendererStoryId = "pstdio-workbench-onboarding--document-renderer";
const focusContextStoryId = "pstdio-workbench-onboarding--focus-and-context";
const paletteResourcesStoryId = "pstdio-workbench-onboarding--palette-resources";

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/projects`);
  expect(response.ok()).toBe(true);
  for (const project of (await response.json()) as Array<{ id: string }>) {
    expect((await request.delete(`${apiBase}/v1/projects/${project.id}`)).ok()).toBe(true);
  }
};

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-167 Nav Chrome" } });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const prepareDashboard = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
  }, projectId);
  await page.setViewportSize({ width: 1280, height: 720 });
};

const orderedCenters = async (locators: import("@playwright/test").Locator[]) => {
  const centers = await Promise.all(
    locators.map(async (locator) => {
      const box = await locator.boundingBox();
      expect(box).not.toBeNull();
      return box!.x + box!.width / 2;
    }),
  );
  expect(centers).toEqual([...centers].sort((left, right) => left - right));
};

const backgroundColor = (locator: import("@playwright/test").Locator) =>
  locator.evaluate((element) => getComputedStyle(element).backgroundColor);

test("PS-167 keeps navigation and region controls in one stable Nav Chrome", async ({ page, request }) => {
  test.setTimeout(45_000);
  await deleteAllProjects(request);
  const project = await createProject(request);
  const statuses = await getPlannerTicketStatuses(request, apiBase, project.id);
  const backlog = statuses.find((status) => status.name.toLowerCase() === "backlog");
  expect(backlog).toBeDefined();
  const ticket = await createPlannerTicket(request, apiBase, project.id, {
    content: "Own navigation chrome",
    statusId: backlog!.id,
  });
  await prepareDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/tickets`);

  const nav = page.locator('[data-workbench-region="nav"]');
  const navNode = await nav.elementHandle();
  expect(navNode).not.toBeNull();
  await expect(nav).toBeVisible();

  const back = nav.getByRole("button", { name: "Navigate back" });
  const forward = nav.getByRole("button", { name: "Navigate forward" });
  const secondary = nav.getByRole("button", { name: "Hide Secondary Panel" });
  const side = nav.getByRole("button", { name: "Show Side Panel" });

  await expect(back).toBeVisible();
  await expect(forward).toBeVisible();
  await expect(nav.locator("[data-workbench-breadcrumb-action-slot]")).toBeVisible();
  await expect(nav.getByRole("button", { name: /Sidebar/ })).toHaveCount(0);
  await expect(secondary).toHaveAttribute("aria-pressed", "true");
  await expect(side).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("workbench-session-bubble")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open session panel" })).toHaveCount(0);
  const selectedBackground = await backgroundColor(secondary);
  expect(await backgroundColor(side)).not.toBe(selectedBackground);
  await orderedCenters([back, forward, secondary, side]);

  const mainHeader = page.locator('[data-workbench-panel-header="main"]');
  await expect(mainHeader.getByRole("button", { name: /Navigate (back|forward)/ })).toHaveCount(0);
  await expect(mainHeader.getByRole("button", { name: /Secondary Panel|Side Panel|Sidebar/ })).toHaveCount(0);

  await page.getByRole("option", { name: "Tickets", exact: true }).click();
  const sidebarSeparator = page.getByRole("separator", { name: "Resize sidebar" });
  await expect(sidebarSeparator).toBeVisible();
  await sidebarSeparator.press("Home");
  const closedSidebar = nav.getByRole("button", { name: "Show Sidebar" });
  await expect(closedSidebar).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => backgroundColor(closedSidebar)).not.toBe(selectedBackground);
  await orderedCenters([closedSidebar, back, forward, secondary, side]);

  await page.getByText("Own navigation chrome", { exact: true }).click();
  await expect(page.getByRole("link", { name: `${ticket.shorthand} Own navigation chrome` })).toBeVisible();
  await expect(back).toBeDisabled();
  await expect(forward).toBeDisabled();
  await expect(closedSidebar).toBeVisible();
  expect(await navNode!.evaluate((element) => element.isConnected)).toBe(true);

  await closedSidebar.focus();
  await expect(closedSidebar).toBeFocused();
  await closedSidebar.press("Enter");
  await expect(sidebarSeparator).toBeVisible();
  await expect(nav.getByRole("button", { name: /Sidebar/ })).toHaveCount(0);

  await side.click();
  const openSide = nav.getByRole("button", { name: "Hide Side Panel" });
  await expect(openSide).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => backgroundColor(openSide)).toBe(selectedBackground);
  await expect(page.getByTestId("workbench-session-attached-panel")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open session panel" })).toHaveCount(0);
  await openSide.click();
  const closedSide = nav.getByRole("button", { name: "Show Side Panel" });
  await expect(closedSide).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => backgroundColor(closedSide)).not.toBe(selectedBackground);
  const sessionLauncher = page.getByRole("button", { name: "Open session panel" });
  await expect(sessionLauncher).toBeVisible();
  await expect(page.getByTestId("workbench-session-bubble")).toHaveCount(0);
  await expect(page.getByTestId("workbench-session-attached-panel")).not.toBeVisible();

  await sessionLauncher.click();
  const floatingSession = page.getByTestId("workbench-session-bubble");
  await expect(floatingSession).toBeVisible();
  await expect(sessionLauncher).toHaveCount(0);
  await floatingSession.getByRole("button", { name: "Minimize panel" }).click();
  await expect(sessionLauncher).toBeVisible();

  await sessionLauncher.click();
  await floatingSession.getByRole("button", { name: "Attach panel" }).click();
  await expect(page.getByTestId("workbench-session-attached-panel")).toBeVisible();
  await expect(sessionLauncher).toHaveCount(0);
});

test("PS-167 opens the Secondary Panel from Workspaces before the first terminal", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProject(request);
  await prepareDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/tickets`);

  const nav = page.locator('[data-workbench-region="nav"]');
  const hideSecondary = nav.getByRole("button", { name: "Hide Secondary Panel" });
  await expect(hideSecondary).toBeVisible();
  await hideSecondary.click();

  await page.getByRole("option", { name: /^Workspaces/ }).click();
  const showSecondary = nav.getByRole("button", { name: "Show Secondary Panel" });
  await expect(showSecondary).toHaveAttribute("aria-pressed", "false");
  await showSecondary.click();

  await expect(nav.getByRole("button", { name: "Hide Secondary Panel" })).toHaveAttribute("aria-pressed", "true");
  const secondaryPanel = page.locator('[data-workbench-region="secondary"]');
  await expect(secondaryPanel).toBeVisible();
  await expect(secondaryPanel.getByRole("button", { name: "New terminal" })).toBeVisible();
});

test.describe("PS-167 breadcrumb Storybook contract", () => {
  test.slow();

  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(breadcrumbStoryId, "pstdio-workbench"));
  });

  test.afterAll(() => {
    storybook?.kill();
  });

  test("shows a real multi-level path with actions and a session indicator", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, breadcrumbStoryId));

    const nav = page.locator('[data-workbench-region="nav"]');
    await expect(nav).toBeVisible({ timeout: 30_000 });
    await expect(nav.getByRole("button", { name: "Docs" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Concepts" })).toBeVisible();
    await expect(nav.getByText("Regions", { exact: true })).toBeVisible();
    await expect(nav.getByLabel("Session status")).toBeVisible();
  });

  test("shows recovery controls only for registered regions and navigates existing tabs", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, paletteResourcesStoryId));

    const nav = page.locator('[data-workbench-region="nav"]');
    await expect(nav).toBeVisible({ timeout: 30_000 });
    await expect(nav.getByRole("button", { name: /Sidebar/ })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: /Secondary Panel/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Search PS" }).click();
    await page.getByText("PS-101 Palette resource providers", { exact: true }).click();

    const paletteTab = page.getByRole("tab", { name: "Palette resources" });
    const ticketTab = page.getByRole("tab", { name: "PS-101" });
    const tabNames = async () => page.getByRole("tab").allTextContents();
    const initialTabNames = await tabNames();
    expect(initialTabNames).toEqual(["Palette resources", "PS-101"]);
    await expect(ticketTab).toHaveAttribute("aria-selected", "true");

    await nav.getByRole("button", { name: "Navigate back" }).click();
    await expect(paletteTab).toHaveAttribute("aria-selected", "true");
    expect(await tabNames()).toEqual(initialTabNames);

    await nav.getByRole("button", { name: "Navigate forward" }).click();
    await expect(ticketTab).toHaveAttribute("aria-selected", "true");
    expect(await tabNames()).toEqual(initialTabNames);
  });

  test("does not allow a closed panel to become the active focus region", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, focusContextStoryId));

    await page.getByRole("button", { name: "Hide Secondary Panel" }).click();

    await expect(page.getByRole("button", { name: "Focus panel" })).toBeDisabled();
    await expect(page.getByText("focus main", { exact: true }).first()).toBeVisible();
  });

  test("disables history after every added tab closes", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, paletteResourcesStoryId));

    const results = [
      "PS-101 Palette resource providers",
      "PS-118 Extension search bridge",
      "PS-144 Resource activation",
    ];
    for (const [index, result] of results.entries()) {
      if (index > 0) await page.getByRole("tab", { name: "Palette resources" }).click();
      await page.getByRole("button", { name: "Search PS" }).click();
      await page.getByText(result, { exact: true }).click();
    }

    await expect(page.getByRole("tab")).toHaveCount(4);
    for (let remaining = 3; remaining > 0; remaining -= 1) {
      const closeButtons = page.getByRole("button", { name: /^Close PS-/ });
      await expect(closeButtons).toHaveCount(remaining);
      await closeButtons.last().click();
    }

    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Search PS" })).toBeVisible();
    const nav = page.locator('[data-workbench-region="nav"]');
    await expect(nav.getByRole("button", { name: "Navigate back" })).toBeDisabled();
    await expect(nav.getByRole("button", { name: "Navigate forward" })).toBeDisabled();
  });

  test("renders code documents inside the workbench theme provider", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, documentRendererStoryId));

    await page.getByRole("tab", { name: "example.ts" }).click();

    await expect(page.locator(".monaco-editor")).toBeVisible();
  });
});
