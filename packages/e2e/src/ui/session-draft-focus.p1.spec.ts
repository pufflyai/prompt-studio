import { rmSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";
import { createGitRepo } from "./helpers/workspace-session-attempt";

// Critical: opening a new session must accept keyboard input without an extra click.
test("new session tabs focus their composer and keep workspace selection available", async ({ page, request }) => {
  const folder = createGitRepo("session-focus-", "Session composer focus");
  let projectId: string | undefined;
  try {
    const created = await request.post(`${uiOrigin}/v1/projects`, {
      data: folderProjectInput({ name: "New session focus" }, folder),
    });
    expect(created.ok()).toBe(true);
    projectId = (await created.json()).id;
    // A selection with no alternative is intentionally inert. Give the picker a real choice.
    const alternativeResponse = await request.post(`${uiOrigin}/v1/workspaces`, {
      data: { project_id: projectId, provider_id: "pstdio.worktree", params: {} },
    });
    expect(alternativeResponse.ok()).toBe(true);
    const alternative = await alternativeResponse.json();
    const workspaces = await (await request.get(`${uiOrigin}/v1/workspaces?project_id=${projectId}`)).json();
    const current = workspaces.find((workspace: { isDefault: boolean }) => workspace.isDefault);
    expect(current).toBeTruthy();
    const workspaceLabel = current.name ?? current.shorthand ?? current.id;
    await page.addInitScript(() => {
      if (window === window.top) localStorage.setItem("onboarding-complete", "true");
    });
    await page.goto(`/projects/${projectId}/sessions`);
    const main = page.locator('[data-workbench-panel="main"]');
    const mainInput = main.locator('[data-testid="content-editable"][contenteditable="true"]');
    await expect(mainInput).toBeFocused();
    await page.keyboard.type("Main session draft");
    await expect(mainInput).toHaveText("Main session draft");
    await expect(main.getByRole("button", { name: workspaceLabel, exact: true })).toBeEnabled();
    await main.getByRole("button", { name: workspaceLabel, exact: true }).click();
    await page.getByRole("menuitemradio", { name: alternative.workspace_shorthand, exact: true }).click();
    await expect(main.getByRole("button", { name: alternative.workspace_shorthand, exact: true })).toBeEnabled();
    await expect(mainInput).toHaveText("Main session draft");
    await expect(main.getByRole("button", { name: "Open workspace", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Open Side Panel", exact: true }).click();
    const side = page.locator('[data-workbench-panel="side"]');
    await expect(side.locator('[data-testid="content-editable"][contenteditable="true"]')).toBeFocused();
    const header = page.locator('[data-workbench-panel-header="side"]');
    await header.getByRole("button", { name: "Add panel", exact: true }).click();
    await page.getByRole("menuitem", { name: "New session", exact: true }).click();
    const sideInput = side.locator('[data-testid="content-editable"][contenteditable="true"]:visible');
    await expect(sideInput).toBeFocused();
    await page.keyboard.type("New tab draft");
    await expect(sideInput).toHaveText("New tab draft");
    await expect(mainInput).toHaveText("Main session draft");
    await expect(side.getByRole("button", { name: workspaceLabel, exact: true })).toBeEnabled();
    await expect(side.getByRole("button", { name: "Open workspace", exact: true })).toHaveCount(0);

    await header.getByRole("button", { name: "Add panel", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    // Extension-owned addable panels no longer put Sessions first. Use the menu’s keyboard search.
    await page.keyboard.type("New session");
    await expect(page.getByRole("menuitem", { name: "New session", exact: true })).toHaveAttribute(
      "data-highlighted",
      "",
    );
    await page.keyboard.press("Enter");
    await expect(sideInput).toBeFocused();
    await page.keyboard.type("Keyboard-created draft");
    await expect(sideInput).toHaveText("Keyboard-created draft");
    await expect(mainInput).toHaveText("Main session draft");
  } finally {
    try {
      if (projectId) await request.delete(`${uiOrigin}/v1/projects/${projectId}`);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }
});
