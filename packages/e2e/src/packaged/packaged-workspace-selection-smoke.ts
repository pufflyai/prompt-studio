import { expect } from "bun:test";
import { chromium, expect as expectBrowser } from "@playwright/test";
import { observeTreeRows } from "../helpers/tree-continuity";
import { type RuntimeDescriptor, runtimeAuthorization, signInBrowser } from "./packaged-serve-helpers";

export const expectPackagedWorkspaceSelection = async (descriptor: RuntimeDescriptor, projectId: string) => {
  const baseUrl = descriptor.origin;
  const headers = runtimeAuthorization(descriptor);
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
    await signInBrowser(page, descriptor);
    await page.goto(`${baseUrl}/projects/${projectId}/extensions/pstdio.pstdio-planner/tickets`);
    await page.getByTestId("renderer-card").getByText("Packaged workspace selection", { exact: true }).click();
    const sidenav = page.locator('[data-workbench-region="sidenav"]');
    const ticket = sidenav.getByRole("option", {
      name: `${outcome.value.shorthand} Packaged workspace selection`,
      exact: true,
    });
    // The packaged runtime installs the planner from its release tag, which names this row
    // "Project workspace" until the release that renames it to "Project folder".
    const workspace = sidenav.getByRole("option", { name: /^Project (workspace|folder)$/ });
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
