import { expect, test } from "@playwright/test";
import { WORKSPACES_COLLECTION_ID } from "pstdio-api-contracts";
import { folderProjectInput } from "../helpers/folder-project";

test("native Workspaces saves shared views and isolates each project's selection", async ({ page, request }) => {
  const projects: { id: string }[] = [];
  for (const name of ["Saved workspace views", "Other workspace views"]) {
    const response = await request.post("/v1/projects", { data: folderProjectInput({ name }) });
    expect(response.ok()).toBe(true);
    projects.push(await response.json());
  }
  const [first, second] = projects;
  const path = `/v1/projects/${first!.id}/boards/${WORKSPACES_COLLECTION_ID}/views`;
  await page.addInitScript((projectId) => {
    localStorage.setItem("onboarding-complete", "true");
    if (!localStorage.getItem("dashboard-wb2:selected-project:global"))
      localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, first!.id);
  try {
    await page.goto(`/projects/${first!.id}/workspaces`);
    await expect(page.getByRole("button", { name: "Add view", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Add view", exact: true }).click();
    const savedTab = page.getByRole("tab", { name: "View 2", exact: true });
    await expect(savedTab).toHaveAttribute("aria-selected", "true");
    await savedTab.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
    await page.getByRole("textbox", { name: "View name" }).fill("Release workspaces");
    await page.getByRole("button", { name: "Rename", exact: true }).click();
    await page.getByRole("button", { name: "Display settings" }).click();
    await page.getByTestId("data-table-display-menu").getByText("Row numbers", { exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Save view", exact: true }).click();
    await expect(page.getByLabel("Unsaved view changes")).toHaveCount(0);
    const releaseTab = page.getByRole("tab", { name: "Release workspaces", exact: true });
    const saved = await (await request.get(path)).json();
    expect(saved.views.find((view: { title: string }) => view.title === "Release workspaces")).toMatchObject({
      settings: { rowNumbers: false },
    });
    await page.reload();
    await expect(releaseTab).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('[data-column-id="rowIndex"]')).toHaveCount(0);

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
      await expect(otherPage.locator('[data-column-id="rowIndex"]')).toHaveCount(0);
    } finally {
      await otherClient.close();
    }

    await page.getByRole("button", { name: "Switch project", exact: true }).click();
    await page.getByRole("option", { name: /^Other workspace views / }).click();
    await page.goto(`/projects/${second!.id}/workspaces`);
    await expect(page.getByRole("tab", { name: "All", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(releaseTab).toHaveCount(0);
    await expect(page.locator('[data-column-id="rowIndex"]').first()).toBeVisible();
    const otherViews = await (
      await request.get(`/v1/projects/${second!.id}/boards/${WORKSPACES_COLLECTION_ID}/views`)
    ).json();
    expect(otherViews.views).toHaveLength(1);
    await page.getByRole("button", { name: "Switch project", exact: true }).click();
    await page.getByRole("option", { name: /^Saved workspace views / }).click();
    await page.goto(`/projects/${first!.id}/workspaces`);
    await expect(releaseTab).toHaveAttribute("aria-selected", "true");
  } finally {
    for (const project of projects) await request.delete(`/v1/projects/${project.id}`);
  }
});
