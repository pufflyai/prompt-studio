import { rmSync } from "node:fs";
import { folderProjectInput } from "../helpers/folder-project";
import { expect, test } from "../scripts/session-test";
import { uiOrigin as apiBase } from "../ui-server";
import { prepareDashboard } from "./helpers/workspace-files";
import { createGitRepo } from "./helpers/workspace-session-attempt";

// Critical risk: app shortcuts must never take keys people type in the file editor. Monaco types
// into an EditContext element (role="textbox"), not a textarea or contenteditable element.
test("typing punctuation in the file editor never opens keyboard shortcuts", async ({ page, request }) => {
  const root = createGitRepo("pstdio-editor-typing-", "Editor typing e2e");
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Editor typing" }, root),
  });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  try {
    await prepareDashboard(page, project.id);
    await page.goto(`/projects/${project.id}`);
    await page.getByRole("option", { name: "Files", exact: true }).click();
    await page.getByRole("textbox", { name: "Search files" }).fill("README");
    await page
      .getByRole("region", { name: "Files", exact: true })
      .locator('[data-tree-list-node-id="README.md"]')
      .click();
    const editor = page.locator(".monaco-editor").filter({ visible: true });
    await editor.locator(".view-lines").click();
    const lines = editor.locator(".view-lines");
    const reference = page.getByRole("dialog", { name: "Keyboard shortcuts", exact: true });

    // Each key is followed by a letter; the letter reaches the editor only if the key kept focus there.
    // US layout: "?" is Shift plus the Slash key.
    await page.keyboard.type("a");
    await page.keyboard.press("Shift+Slash");
    await page.keyboard.type("b");
    await expect(lines).toContainText("a?b");
    // German layout: "_" is Shift plus the key that reports code "Slash".
    await page.evaluate(() =>
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "_", code: "Slash", shiftKey: true, bubbles: true, cancelable: true }),
      ),
    );
    await page.keyboard.type("c");
    await expect(lines).toContainText("a?bc");
    // The help chord belongs to the editor while it has focus.
    await page.keyboard.press("ControlOrMeta+/");
    await page.keyboard.type("d");
    await expect(lines).toContainText("a?bcd");
    await expect(reference).toHaveCount(0);

    await page.getByRole("button", { name: "Help", exact: true }).focus();
    await page.keyboard.press("ControlOrMeta+/");
    await expect(reference).toBeVisible();
  } finally {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
    rmSync(root, { recursive: true, force: true });
  }
});
