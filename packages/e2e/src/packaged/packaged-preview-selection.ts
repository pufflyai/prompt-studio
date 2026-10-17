import { expect, type Page } from "@playwright/test";
import { serializePageUrl, workbenchPages } from "@pstdio/sdk/extensions";
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
      await isolated.getByRole("option", { name: title, exact: true }).focus();
      await isolated.keyboard.press("Shift+F10");
      await isolated.getByRole("menuitem", { name: "Open session panel", exact: true }).click();
      const tab = header.getByRole("tab", { name: new RegExp(title) });
      await expect(tab).toHaveAttribute("aria-selected", "true");
      return tab;
    };
    const kept = await open("Selection kept");
    await kept.focus();
    await isolated.keyboard.press("Shift+F10");
    await isolated.getByRole("menuitem", { name: "Pin tab", exact: true }).click();
    const old = await open("Selection old");
    const url = serializePageUrl({
      projectId,
      page: { id: "workspace", ref: workbenchPages.workspace, path: "workspace" },
      resource: { type: "workspace", id: workspace.id },
    });
    await isolated.goto(new URL(url, descriptor.origin).href);
    await expect(header.getByRole("tab", { name: /Selection replacement/ })).toHaveAttribute("aria-selected", "true");
    await expect(kept).toHaveAttribute("aria-selected", "false");
    await expect(old).toHaveCount(0);
    await expect(header.getByRole("tab")).toHaveCount(2);
  } finally {
    await context.close();
  }
};
