import { expect, type Page } from "@playwright/test";
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
      const showSide = isolated.getByRole("button", { name: "Show Side Panel", exact: true });
      if (await showSide.isVisible()) await showSide.click();
      await header.getByRole("button", { name: "Add panel", exact: true }).click();
      await isolated.getByRole("menuitem", { name: "Session", exact: true }).click();
      await header.getByRole("tab", { selected: true }).click({ button: "right" });
      await isolated.getByRole("menuitem", { name: "Switch session", exact: true }).click();
      const picker = isolated.getByRole("dialog", { name: "Switch session", exact: true });
      await picker.getByRole("textbox").fill(title);
      await picker.getByRole("textbox").press("Enter");
      const tab = header.getByRole("tab", { name: new RegExp(title) });
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await tab.click({ button: "right" });
      await isolated.getByRole("menuitem", { name: "Unpin tab", exact: true }).click();
      await expect(tab).toHaveCSS("font-style", "italic");
      return tab;
    };
    const kept = await open("Selection kept");
    await kept.focus();
    await isolated.keyboard.press("Shift+F10");
    await isolated.getByRole("menuitem", { name: "Pin tab", exact: true }).click();
    await expect(kept).toHaveCSS("font-style", "normal");
    const old = await open("Selection old");
    await isolated
      .getByRole("region", { name: "Side Panel", exact: true })
      .getByRole("button", { name: "Open workspace", exact: true })
      .click();
    await expect(header.getByRole("tab", { name: /Selection replacement/ })).toHaveAttribute("aria-selected", "true");
    await expect(kept).toHaveAttribute("aria-selected", "false");
    await expect(old).toHaveCount(0);
    await expect(header.getByRole("tab")).toHaveCount(2);
  } finally {
    await context.close();
  }
};
