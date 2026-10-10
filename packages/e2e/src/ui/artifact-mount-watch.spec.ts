import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { writeWatchedMountExtension } from "../helpers/watched-mount-extension";

test("an open webview refreshes when a watched mount file changes on disk", async ({
  page,
  request,
  baseURL,
}, testInfo) => {
  const parent = process.env.E2E_FIXTURE_ROOT ?? tmpdir();
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, "artifact-mount-watch-"));
  const source = writeWatchedMountExtension(root);
  const boards = join(root, ".pstdio", "extension-storage", "board-fixture", "boards");
  const response = await request.post(`${baseURL}/v1/projects`, {
    data: folderProjectInput({ name: "Watched mounts" }, root),
  });
  expect(response.ok(), await response.text()).toBe(true);
  const project = (await response.json()) as { id: string };
  try {
    const enabled = await request.post(
      `${baseURL}/v1/projects/${project.id}/extensions/installed/board-fixture/enable`,
      {
        data: {
          displayName: "Board fixture",
          extensionId: "test.board-fixture",
          manifest: { id: "test.board-fixture", name: "board-fixture" },
          name: "board-fixture",
          sourceHash: "artifact-mount-watch-test",
          sourceKind: "local_path",
          sourcePath: source,
          sourceRef: null,
          version: "1.0.0",
        },
      },
    );
    expect(enabled.ok(), await enabled.text()).toBe(true);

    await page.goto(`/projects/${project.id}/extensions/test.board-fixture/boards`);
    const output = page.frameLocator('iframe[title="Board fixture"]').locator("output");
    await expect(output).toHaveText("Load 1: no boards");
    // The host creates the mount folder when it starts watching it.
    await expect.poll(() => existsSync(boards)).toBe(true);

    // An agent or editor writes the file directly. A macOS watch can miss changes made the
    // moment it starts, so the write repeats until the view shows it.
    await expect(async () => {
      writeFileSync(join(boards, "sales.json"), JSON.stringify({ savedAt: Date.now() }));
      await expect(output).toContainText("sales.json", { timeout: 1_500 });
    }).toPass({ timeout: 10_000 });
    const screenshot = testInfo.outputPath("watched-mount-refresh.png");
    await page.screenshot({ path: screenshot });
    await testInfo.attach("watched-mount-refresh", { path: screenshot, contentType: "image/png" });

    // A write through the mount API is not a file change. The command would emit its own event.
    await page.waitForTimeout(1_500);
    const settled = await output.textContent();
    const saved = await request.post(
      `${baseURL}/v1/projects/${project.id}/extensions/commands/test.board-fixture.command.save/execute`,
      { data: {} },
    );
    expect(saved.ok(), await saved.text()).toBe(true);
    expect(existsSync(join(boards, "saved.json"))).toBe(true);
    await page.waitForTimeout(2_000);
    await expect(output).toHaveText(settled ?? "");
  } finally {
    await request.delete(`${baseURL}/v1/projects/${project.id}`);
    rmSync(root, { recursive: true, force: true });
  }
});
