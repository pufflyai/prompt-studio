import { mkdtempSync, renameSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

// Chromium rejects stale disk-backed File objects after a failed upload's source is edited.
test("installs a corrected extension folder when Retry is clicked", async ({ page, request }) => {
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Extension install retry" }),
  });
  expect(created.ok()).toBe(true);
  const { id } = await created.json();
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    localStorage.setItem(
      `pstdio-project-settings/projects/${projectId}/values`,
      JSON.stringify({ state: { sessionModalState: "closed" }, version: 0 }),
    );
  }, id);
  await page.goto(`/projects/${id}`);
  await page.getByRole("option", { name: "Extensions", exact: true }).click();
  const dropZone = page.getByTestId("extension-folder-drop-zone");
  await dropZone.scrollIntoViewIfNeeded();
  const bounds = await dropZone.boundingBox();
  if (!bounds) throw new Error("Extension folder drop zone is not visible");
  const folder = mkdtempSync(join(process.env.E2E_HOME!, "folder-retry-"));
  try {
    const manifest = {
      name: "folder-install-retry",
      version: "1.0.0",
      main: "./extension.ts",
      displayName: "Corrected folder retry",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    };
    const packagePath = join(folder, "package.json");
    writeFileSync(packagePath, JSON.stringify(manifest));
    utimesSync(packagePath, 1700000000, 1700000000);
    writeFileSync(join(folder, "extension.ts"), "export { default } from './command.ts';");
    const session = await page.context().newCDPSession(page);
    const data = { items: [], files: [folder], dragOperationsMask: 1 };
    const installResponse = () =>
      page.waitForResponse(
        (entry) => entry.request().method() === "POST" && entry.url().endsWith(`/v1/projects/${id}/extensions/install`),
        { timeout: 20_000 },
      );
    const firstRequest = installResponse();
    for (const type of ["dragEnter", "dragOver", "drop"] as const)
      await session.send("Input.dispatchDragEvent", {
        type,
        x: Math.round(bounds.x + bounds.width / 2),
        y: Math.round(bounds.y + bounds.height / 2),
        data,
      });
    const rejected = await firstRequest;
    expect(rejected.status(), await rejected.text()).toBe(422);
    const retry = page.getByRole("button", { name: "Retry", exact: true });
    await expect(retry).toBeVisible();
    const updated = join(folder, "updated.json");
    writeFileSync(updated, JSON.stringify({ ...manifest, publisher: "test" }));
    utimesSync(updated, 1700000003, 1700000003);
    renameSync(updated, packagePath);
    writeFileSync(
      join(folder, "command.ts"),
      `export default { commands: [{ id: "hello", ref: { kind: "command", id: "hello" }, title: "Hello", run() {} }] };`,
    );
    const [accepted] = await Promise.all([installResponse(), retry.click()]);
    expect(accepted.status(), await accepted.text()).toBe(201);
    await expect(page.getByTestId("extension-entry").filter({ hasText: manifest.displayName })).toBeVisible();
    await expect(retry).toHaveCount(0);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
