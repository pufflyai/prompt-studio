import { expect, test } from "@playwright/test";
import { createPlannerTicket, getPlannerTicketStatuses } from "../helpers/planner-api";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
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
    localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
    localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
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

test("keeps navigation and region controls in one stable Nav Chrome", async ({ page, request }) => {
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

  const nav = page
    .locator('[data-workbench-region="nav"]')
    .filter({ has: page.getByRole("button", { name: "Navigate back" }) })
    .first();
  await expect(nav).toBeVisible();
  await page.getByRole("option", { name: "Tickets", exact: true }).click();
  await expect(page.getByText("Own navigation chrome", { exact: true })).toBeVisible();

  const back = nav.getByRole("button", { name: "Navigate back" });
  const forward = nav.getByRole("button", { name: "Navigate forward" });
  const showSecondary = nav.getByRole("button", { name: "Show Secondary Panel" });

  await expect(back).toBeVisible();
  await expect(forward).toBeVisible();
  await expect(nav.locator("[data-workbench-breadcrumb-action-slot]")).toBeVisible();
  await expect(nav.getByRole("button", { name: /Sidenav/ })).toHaveCount(0);
  await expect(showSecondary).toHaveAttribute("aria-pressed", "false");
  const closedPanelBackground = await backgroundColor(showSecondary);
  await showSecondary.click();
  const secondary = nav.getByRole("button", { name: "Hide Secondary Panel" });
  await expect(secondary).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => backgroundColor(secondary)).not.toBe(closedPanelBackground);
  await expect(page.getByTestId("workbench-side-panel-floating")).toHaveCount(0);
  // A session can be started from any project location, so the Tickets board offers the
  // Side Panel exactly as the Workspaces view does. Its control belongs to the Nav
  // Chrome, beside the other region controls.
  await expect(nav.getByRole("button", { name: "Show Side Panel" })).toHaveAttribute("aria-pressed", "false");
  await orderedCenters([back, forward, secondary]);

  const mainHeader = page.locator('[data-workbench-panel-header="main"]');
  await expect(mainHeader.getByRole("button", { name: /Navigate (back|forward)/ })).toHaveCount(0);
  await expect(mainHeader.getByRole("button", { name: /Secondary Panel|Side Panel|Sidenav/ })).toHaveCount(0);

  const sidenavSeparator = page.getByRole("separator", { name: "Resize sidenav" });
  await expect(sidenavSeparator).toBeVisible();
  await sidenavSeparator.press("Home");
  const closedSidenav = nav.getByRole("button", { name: "Show Sidenav" });
  await expect(closedSidenav).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => backgroundColor(closedSidenav)).toBe(closedPanelBackground);
  await orderedCenters([closedSidenav, back, forward, secondary]);

  await page.getByText("Own navigation chrome", { exact: true }).click();
  await expect(page.getByRole("link", { name: `${ticket.shorthand} Own navigation chrome` })).toBeVisible();
  await expect(back).toBeEnabled();
  await expect(forward).toBeDisabled();
  await back.click();
  await expect(
    page.getByRole("navigation", { name: "breadcrumb" }).getByText("Tickets", { exact: true }),
  ).toBeVisible();
  await expect(forward).toBeEnabled();
  await expect(closedSidenav).toBeVisible();

  await closedSidenav.focus();
  await expect(closedSidenav).toBeFocused();
  await closedSidenav.press("Enter");
  await expect(sidenavSeparator).toBeVisible();
  await expect(nav.getByRole("button", { name: /Sidenav/ })).toHaveCount(0);

  await forward.click();
  await expect(page.getByRole("link", { name: `${ticket.shorthand} Own navigation chrome` })).toBeVisible();
  await expect(nav.getByRole("button", { name: /Sidenav/ })).toHaveCount(0);
  const side = nav.getByRole("button", { name: "Show Side Panel" });
  await expect(side).toHaveAttribute("aria-pressed", "false");
  expect(await backgroundColor(side)).toBe(closedPanelBackground);

  await side.click();
  const openSide = nav.getByRole("button", { name: "Hide Side Panel" });
  await expect(openSide).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => backgroundColor(openSide)).not.toBe(closedPanelBackground);
  await expect(page.getByTestId("workbench-side-panel-attached")).toBeVisible();
  await page.locator('[data-workbench-panel-header="side"]').getByRole("button", { name: "Add panel" }).click();
  const draft = "Keep this draft while the Side Panel moves";
  const attachedSession = page.getByTestId("workbench-side-panel-attached");
  const chatInput = attachedSession.locator("[data-testid='content-editable'][contenteditable='true']").last();
  await chatInput.fill(draft);
  const sideRegionNode = await attachedSession.getByRole("region", { name: "Side Panel" }).elementHandle();
  const chatInputNode = await chatInput.elementHandle();
  expect(sideRegionNode).not.toBeNull();
  expect(chatInputNode).not.toBeNull();
  await expect(page.getByRole("button", { name: "Open Side Panel" })).toHaveCount(0);
  await openSide.click();
  const closedSide = nav.getByRole("button", { name: "Show Side Panel" });
  await expect(closedSide).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => backgroundColor(closedSide)).toBe(closedPanelBackground);
  const sessionLauncher = page.getByRole("button", { name: "Open Side Panel" });
  await expect(sessionLauncher).toBeVisible();
  await expect(page.getByTestId("workbench-side-panel-floating")).toHaveCount(0);
  await expect(page.getByTestId("workbench-side-panel-attached")).not.toBeVisible();

  await sessionLauncher.click();
  const floatingSession = page.getByTestId("workbench-side-panel-floating");
  await expect(floatingSession).toBeVisible();
  await expect(floatingSession.locator("[data-testid='content-editable'][contenteditable='true']").last()).toHaveText(
    draft,
  );
  expect(
    await floatingSession
      .getByRole("region", { name: "Side Panel" })
      .evaluate((node, original) => node === original, sideRegionNode),
  ).toBe(true);
  expect(await chatInputNode!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(sessionLauncher).toHaveCount(0);
  await floatingSession.getByRole("button", { name: "Close Side Panel" }).click();
  await expect(sessionLauncher).toBeVisible();

  await sessionLauncher.click();
  await floatingSession.getByRole("button", { name: "Reattach Side Panel" }).click();
  await expect(attachedSession).toBeVisible();
  await expect(chatInput).toHaveText(draft);
  expect(await chatInputNode!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(sessionLauncher).toHaveCount(0);
});

test("keeps the Secondary Panel closed from Workspaces until requested", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProject(request);
  await prepareDashboard(page, project.id);
  await page.goto(`/projects/${project.id}/tickets`);

  const nav = page.locator('[data-workbench-region="nav"]');
  const showSecondary = nav.getByRole("button", { name: "Show Secondary Panel" });
  await expect(showSecondary).toHaveAttribute("aria-pressed", "false");

  await page.goto(`/projects/${project.id}/workspaces`);
  await expect(page.getByRole("heading", { name: "No workspaces yet" })).toBeVisible();
  await expect(showSecondary).toHaveAttribute("aria-pressed", "false");
  await showSecondary.click();

  await expect(nav.getByRole("button", { name: "Hide Secondary Panel" })).toHaveAttribute("aria-pressed", "true");
  const secondaryPanel = page.locator('[data-workbench-region="secondary"]');
  await expect(secondaryPanel).toBeVisible();
  await expect(secondaryPanel.getByRole("button", { name: "Add panel" })).toBeVisible();
});
