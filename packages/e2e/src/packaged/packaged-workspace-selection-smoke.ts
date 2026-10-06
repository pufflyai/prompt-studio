import { expect } from "bun:test";
import { chromium, expect as expectBrowser } from "@playwright/test";
import { observeTreeRows } from "../helpers/tree-continuity";

export const expectPackagedWorkspaceSelection = async (
  baseUrl: string,
  projectId: string,
  headers: Record<string, string>,
) => {
  const response = await fetch(
    `${baseUrl}/v1/projects/${projectId}/extensions/commands/pstdio.pstdio-planner.command.create-ticket/execute`,
    {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ source: "api", params: { content: "# Packaged workspace selection" } }),
    },
  );
  expect(response.status).toBe(200);
  const { outcome } = await response.json();
  expect(outcome.ok).toBe(true);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.addInitScript((projectId) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    }, projectId);
    await page.goto(`${baseUrl}/projects/${projectId}/extensions/pstdio.pstdio-planner/tickets`);
    await page.getByTestId("renderer-card").getByText("Packaged workspace selection", { exact: true }).click();
    const sidenav = page.locator('[data-workbench-region="sidenav"]');
    const ticket = sidenav.getByRole("option", {
      name: `${outcome.value.shorthand} Packaged workspace selection`,
      exact: true,
    });
    const workspace = sidenav.getByRole("option", { name: "Project workspace", exact: true });
    await expectBrowser(ticket).toHaveAttribute("aria-selected", "true");
    const finishObservingRows = await observeTreeRows(sidenav, [
      ticket,
      workspace,
      sidenav.getByRole("option", { name: "Search", exact: true }),
      sidenav.getByRole("option", { name: "Settings", exact: true }),
    ]);
    await workspace.click();
    await expectBrowser(workspace).toHaveAttribute("aria-selected", "true");
    await expectBrowser(ticket).toHaveAttribute("aria-selected", "false");
    await page.goBack();
    await expectBrowser(ticket).toHaveAttribute("aria-selected", "true");
    expect(await finishObservingRows()).toEqual([]);
  } finally {
    await browser.close();
  }
};
