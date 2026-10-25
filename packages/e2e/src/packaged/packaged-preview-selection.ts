import { expect, type Page } from "@playwright/test";
import { selectMenuAction } from "../helpers/menu-actions";
import { logTestPhase } from "../scripts/log-test-phase";
import { type RuntimeDescriptor, runtimeAuthorization, signInBrowser } from "./packaged-serve-helpers";

export const verifyPackagedPreviewSelection = async (page: Page, projectId: string, descriptor: RuntimeDescriptor) => {
  const authorization = runtimeAuthorization(descriptor);
  const response = await fetch(`${descriptor.origin}/v1/workspaces?project_id=${projectId}`, {
    headers: authorization,
  });
  expect(response.ok).toBe(true);
  const workspaces = (await response.json()) as Array<{ id: string; is_default: boolean }>;
  const workspace = workspaces.find((entry) => entry.is_default)!;
  for (const title of ["Selection kept", "Selection old", "Selection replacement"]) {
    const created = await fetch(`${descriptor.origin}/v1/sessions`, {
      method: "POST",
      headers: { ...authorization, "content-type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        workspace_id: workspace.id,
        title,
        prompt: "",
        agent: "pstdio.workbench-fixture.harness.fake",
      }),
    });
    expect(created.status).toBe(201);
  }
  const context = await page.context().browser()!.newContext();
  try {
    const isolated = await context.newPage();
    await isolated.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
    await signInBrowser(isolated, descriptor);
    await isolated.goto(`${descriptor.origin}/projects/${projectId}/sessions`);
    const header = isolated.locator('[data-workbench-panel-header="side"]');
    const open = async (title: string) => {
      logTestPhase(`Preview selection open ${title}`);
      const showSide = isolated.getByRole("button", { name: "Show Side Panel", exact: true });
      const openSide = isolated.getByRole("button", { name: "Open Side Panel", exact: true });
      const reattach = isolated.getByRole("button", { name: "Reattach Side Panel", exact: true });
      const addPanel = header.getByRole("button", { name: "Add panel", exact: true });
      await expect(showSide.or(openSide).or(reattach).or(addPanel).filter({ visible: true }).first()).toBeVisible();
      if (await showSide.isVisible()) await showSide.click();
      if (await openSide.isVisible()) {
        await openSide.click();
        await expect(reattach).toBeVisible();
      }
      if (await reattach.isVisible()) await reattach.click();
      await addPanel.click();
      await selectMenuAction(isolated, "New session");
      const newSession = header.getByRole("tab", { name: "New session", exact: true });
      await expect(newSession).toHaveAttribute("aria-selected", "true");
      await newSession.click({ button: "right" });
      await isolated.getByRole("menuitem", { name: "Switch session", exact: true }).click();
      const picker = isolated.getByRole("dialog", { name: "Switch session", exact: true });
      await picker.getByRole("textbox").fill(title);
      await picker.getByRole("textbox").press("Enter");
      const tab = header.getByRole("tab", { name: new RegExp(title) });
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await tab.click({ button: "right" });
      await selectMenuAction(isolated, "Unpin tab");
      await expect(tab).toHaveCSS("font-style", "italic");
      logTestPhase(`Preview selection opened ${title}`);
      return tab;
    };
    const kept = await open("Selection kept");
    await kept.focus();
    await isolated.keyboard.press("Shift+F10");
    await selectMenuAction(isolated, "Pin tab");
    await expect(kept).toHaveCSS("font-style", "normal");
    logTestPhase("Preview selection kept pinned");
    const old = await open("Selection old");
    await isolated
      .getByRole("region", { name: "Side Panel", exact: true })
      .getByRole("button", { name: "Open workspace", exact: true })
      .click();
    logTestPhase("Preview selection workspace opened");
    // Leaving the page closes the old preview before the destination places its related tab.
    await expect(header.getByRole("tab", { name: /Selection replacement/ })).toHaveAttribute("aria-selected", "false");
    await expect(kept).toHaveAttribute("aria-selected", "true");
    await expect(old).toHaveCount(0);
    await expect(header.getByRole("tab")).toHaveCount(2);
  } finally {
    await context.close();
  }
};
