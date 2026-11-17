import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

const repoRoot = resolve(import.meta.dirname, "../../../..");

test("dependent choice refresh preserves the open picker and focus when six choices narrow to one", async ({
  page,
  request,
}) => {
  const parent = join(repoRoot, "__test-tmp__");
  mkdirSync(parent, { recursive: true });
  const sourcePath = mkdtempSync(join(parent, "command-options-refresh-"));
  execFileSync("bun", [
    "build",
    join(import.meta.dirname, "../fixtures/command-options-refresh/extension.ts"),
    "--target=bun",
    "--outfile",
    join(sourcePath, "extension.ts"),
  ]);
  writeFileSync(
    join(sourcePath, "package.json"),
    JSON.stringify({
      name: "command-options-refresh",
      publisher: "e2e",
      version: "0.1.0",
      main: "extension.ts",
      type: "module",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  const projectPath = join(sourcePath, "project");
  mkdirSync(projectPath);
  let projectId: string | undefined;
  try {
    const project = await request.post(`${uiOrigin}/v1/projects`, {
      data: folderProjectInput({ name: "Refresh choices" }, projectPath),
    });
    expect(project.ok(), await project.text()).toBe(true);
    projectId = (await project.json()).id;
    const enabled = await request.post(
      `${uiOrigin}/v1/projects/${projectId}/extensions/installed/command-options-refresh/enable`,
      {
        data: {
          displayName: "Refresh choices",
          extensionId: "e2e.command-options-refresh",
          manifest: { id: "e2e.command-options-refresh", name: "command-options-refresh" },
          name: "command-options-refresh",
          sourceHash: "command-options-refresh",
          sourceKind: "local_path",
          sourcePath,
          sourceRef: null,
          version: "0.1.0",
        },
      },
    );
    expect(enabled.ok()).toBe(true);
    await page.addInitScript((id) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", id!);
    }, projectId);

    await page.goto(`/projects/${projectId}/extensions/e2e.command-options-refresh/locales`);
    await page.getByRole("button", { name: "Choose locale", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Choose locale" });
    const select = dialog.getByRole("button", { name: "Select locale", exact: true });
    await expect(select).toBeEnabled();
    await select.click();
    const initialPopup = page.locator('[data-scope="menu"][data-part="content"][data-state="open"]');
    await expect(initialPopup.locator('[data-part="item"]')).toHaveCount(6);
    await page.keyboard.press("Escape");
    await expect(initialPopup).toHaveCount(0);
    let release!: () => void;
    let requested!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      requested = resolve;
    });
    await page.route("**/commands/e2e.command-options-refresh.command.choices/execute", async (route) => {
      requested();
      await held;
      await route.continue();
    });
    try {
      await dialog.getByRole("textbox", { name: "Search locales", exact: true }).fill("Ger");
      await dialog.getByRole("button", { name: "Select locale", exact: true }).click();
      await pending;
      // Use the actual popup DOM; menus portaled from a dialog can be aria-hidden by its overlay.
      const popup = page.locator('[data-scope="menu"][data-part="content"][data-state="open"]');
      await expect(popup).toBeVisible();
      await expect(popup.locator('[data-part="item"]')).toHaveCount(6);
      const search = popup.getByPlaceholder("Search options…");
      await expect(search).toBeFocused();
      const originalInput = await search.elementHandle();
      await expect(dialog.getByRole("button", { name: "Run", exact: true })).toBeDisabled();
      release();
      await expect(popup.locator('[data-part="item"]')).toHaveCount(1);
      await expect(popup).toBeVisible();
      await expect(search).toBeFocused();
      expect(
        await originalInput!.evaluate((input) => input.isConnected && input.ownerDocument.activeElement === input),
      ).toBe(true);
      await search.press("ArrowDown");
      await expect(popup.locator('[data-part="item"][data-value="German"]')).toHaveAttribute("data-highlighted", "");
      await search.press("Enter");
      await expect(dialog.getByRole("button", { name: "German", exact: true })).toBeVisible();
      const submitted = page.waitForResponse((response) =>
        response.url().endsWith("/e2e.command-options-refresh.command.choose/execute"),
      );
      await dialog.getByRole("button", { name: "Run", exact: true }).click();
      const response = await submitted;
      expect(response.ok()).toBe(true);
      expect(response.request().postDataJSON().params).toEqual({ search: "Ger", locale: "German" });
      await expect(dialog).toHaveCount(0);
    } finally {
      release();
    }
  } finally {
    if (projectId) await request.delete(`${uiOrigin}/v1/projects/${projectId}`);
    rmSync(sourcePath, { force: true, recursive: true });
  }
});
