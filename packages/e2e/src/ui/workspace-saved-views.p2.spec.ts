import { expect, test } from "@playwright/test";

const board = "pstdio.pstdio-workspaces.view.workspaces";

import { folderProjectInput } from "../helpers/folder-project";

test("the Workspaces extension saves shared views and isolates each project's selection", async ({ page, request }) => {
  const projects: { id: string }[] = [];
  try {
    const created = await Promise.allSettled(
      ["Saved workspace views", "Other workspace views"].map(async (name) => {
        const response = await request.post("/v1/projects", { data: folderProjectInput({ name }) });
        expect(response.ok()).toBe(true);
        return response.json() as Promise<{ id: string }>;
      }),
    );
    for (const result of created) if (result.status === "fulfilled") projects.push(result.value);
    const failures = created.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
    if (failures.length) throw new AggregateError(failures, "Could not create workspace-view projects");
    const [first, second] = projects;
    const path = `/v1/projects/${first!.id}/boards/${board}/views`;
    await page.addInitScript((projectId) => {
      localStorage.setItem("onboarding-complete", "true");
      if (!localStorage.getItem("dashboard-wb2:selected-project:global"))
        localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    }, first!.id);
    await page.goto(`/projects/${first!.id}/workspaces`);
    await expect(page.getByRole("button", { name: "Add view", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Add view", exact: true }).click();
    const savedTab = page.getByRole("tab", { name: "View 3", exact: true });
    await expect(savedTab).toHaveAttribute("aria-selected", "true");
    await savedTab.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
    await page.getByRole("textbox", { name: "View name" }).fill("Release workspaces");
    await page.getByRole("button", { name: "Rename", exact: true }).click();
    await page.getByRole("button", { name: "Display settings" }).click();
    await page.getByRole("button", { name: "Children Hidden", exact: true }).click();
    await page.getByRole("menuitem", { name: "Nested", exact: true }).click();
    await page.keyboard.press("Escape");
    // Keep the real persistence request pending long enough to expose a click-before-save race.
    await page.route(`**/v1/projects/${first!.id}/board-views/*`, async (route) => {
      if (route.request().method() === "PATCH") await new Promise((resolve) => setTimeout(resolve, 300));
      await route.continue();
    });
    const saveView = async (showChildren: boolean) => {
      const saved = page.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          new URL(response.url()).pathname.startsWith(`/v1/projects/${first!.id}/board-views/`) &&
          response.request().postDataJSON()?.settings?.showChildren === showChildren,
      );
      await page.getByRole("button", { name: "Save view", exact: true }).click();
      expect((await saved).ok()).toBe(true);
    };
    await saveView(true);
    expect(
      (await (await request.get(path)).json()).views.find(
        (view: { title: string }) => view.title === "Release workspaces",
      ).settings.showChildren,
    ).toBe(true);
    await page.getByRole("button", { name: "Display settings" }).click();
    await page.getByRole("button", { name: "Children Nested", exact: true }).click();
    await page.getByRole("menuitem", { name: "Hidden", exact: true }).click();
    await page.keyboard.press("Escape");
    await saveView(false);
    await expect(page.getByLabel("Unsaved view changes")).toHaveCount(0);
    const releaseTab = page.getByRole("tab", { name: "Release workspaces", exact: true });
    const saved = await (await request.get(path)).json();
    expect(saved.views.find((view: { title: string }) => view.title === "Release workspaces")).toMatchObject({
      settings: { showChildren: false },
    });
    await page.reload();
    await expect(releaseTab).toHaveAttribute("aria-selected", "true");
    expect(
      (await (await request.get(path)).json()).views.find(
        (view: { title: string }) => view.title === "Release workspaces",
      ).settings.showChildren,
    ).toBe(false);

    // A second client can open the shared view without local view state.
    const otherClient = await page
      .context()
      .browser()!
      .newContext({ baseURL: new URL(page.url()).origin });
    try {
      await otherClient.addInitScript((projectId) => {
        localStorage.setItem("onboarding-complete", "true");
        localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
      }, first!.id);
      const otherPage = await otherClient.newPage();
      await otherPage.goto(`/projects/${first!.id}/workspaces`);
      await otherPage.getByRole("tab", { name: "Release workspaces", exact: true }).click();
      await expect(otherPage.getByRole("tab", { name: "Release workspaces", exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(otherPage.getByTestId("resource-list-renderer")).toBeVisible();
    } finally {
      await otherClient.close();
    }

    await page.getByRole("button", { name: "Switch project", exact: true }).click();
    const projectPicker = page.getByRole("dialog", { name: "Projects", exact: true });
    await projectPicker.getByText("Other workspace views", { exact: true }).click();
    await page.goto(`/projects/${second!.id}/workspaces`);
    await expect(page.getByRole("tab", { name: "By device", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(releaseTab).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Compact", exact: true })).toBeVisible();
    const otherViews = await (await request.get(`/v1/projects/${second!.id}/boards/${board}/views`)).json();
    expect(otherViews.views).toHaveLength(2);
    await page.getByRole("button", { name: "Switch project", exact: true }).click();
    await projectPicker.getByText("Saved workspace views", { exact: true }).click();
    await page.goto(`/projects/${first!.id}/workspaces`);
    await expect(releaseTab).toHaveAttribute("aria-selected", "true");
  } finally {
    await page.unrouteAll({ behavior: "wait" });
    for (const project of projects) await request.delete(`/v1/projects/${project.id}`);
  }
});
