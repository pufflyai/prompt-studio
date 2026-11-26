import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { nativePublicTextEditor } from "../helpers/verify-public-text-editor";
import { expect, test } from "../scripts/session-test";

// Critical: a passage action must let the person author a comment without losing its selection.
test("selected text opens an editable comment popover and publishes the authored text", async ({ page, request }) => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-selection-comments-"));
  const created = await request.post("/v1/projects", { data: folderProjectInput({ name: "Passage comments" }, root) });
  expect(created.ok()).toBe(true);
  const project = await created.json();
  try {
    const response = await request.post(
      `/v1/projects/${project.id}/extensions/commands/pstdio.notes.command.notes.create/execute`,
      { data: { params: { title: "Review this passage" }, source: "api" } },
    );
    expect(response.ok()).toBe(true);
    const note = (await response.json()).outcome.value;
    await page.goto(`/projects/${project.id}/extensions/pstdio.notes/notes`);
    const sidebar = page.locator('[data-workbench-region="sidenav"]');
    await sidebar.getByRole("option", { name: "Notes", exact: true }).click();
    await sidebar.getByRole("option", { name: note.title, exact: true }).click();
    const editor = nativePublicTextEditor(page);
    await expect(editor).toBeVisible();
    await editor.fill("Discuss this passage before changing it.");
    await expect
      .poll(() =>
        readFileSync(join(root, ".pstdio/extension-storage/pstdio.notes/documents", note.id, "content.md"), "utf8"),
      )
      .toContain("Discuss this passage before changing it.");
    await editor.evaluate((element) => {
      const text = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode()!;
      const range = document.createRange();
      range.setStart(text, 0);
      range.setEnd(text, 20);
      const selection = document.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    });
    const toolbar = page.locator(".floating-text-format-toolbar.active");
    await expect(toolbar.getByRole("button", { name: "Comment", exact: true })).toBeVisible();
    await toolbar.getByRole("button", { name: "Comment", exact: true }).click();
    const composer = page.getByRole("dialog", { name: "Comment on selection", exact: true });
    const input = composer.getByRole("textbox", { name: "Write a comment…", exact: true });
    await expect(input).toBeFocused();
    await input.fill("Clarify the retry behavior.");
    const receivedPost = Promise.withResolvers<void>();
    const releasePost = Promise.withResolvers<void>();
    await page.route(
      "**/activity/publish",
      async (route) => {
        receivedPost.resolve();
        await releasePost.promise;
        await route.fulfill({ status: 503, json: { error: "Temporarily unavailable" } });
      },
      { times: 1 },
    );
    await composer.getByRole("button", { name: "Submit comment", exact: true }).click();
    await receivedPost.promise;
    await page.keyboard.press("Escape");
    await expect(composer).toBeVisible();
    releasePost.resolve();
    await expect(composer).toContainText("Could not post comment");
    await expect(input).toHaveText("Clarify the retry behavior.");
    await composer.getByRole("button", { name: "Submit comment", exact: true }).click();
    await expect(composer).toHaveCount(0);
    const activity = page.getByLabel("Resource activity", { exact: true });
    await expect(activity.getByText("Clarify the retry behavior.", { exact: true })).toBeVisible();
    await expect(activity).toContainText("Discuss this passage");
    await expect(editor).toHaveText("Discuss this passage before changing it.");
    await editor.evaluate((element) => {
      const text = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode()!;
      const range = document.createRange();
      range.setStart(text, 0);
      range.setEnd(text, 20);
      const selection = document.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    });
    const ask = toolbar.getByRole("button", { name: "Ask agent", exact: true });
    await expect(ask).toBeVisible();
    const sessionsBefore = await (await request.get(`/v1/projects/${project.id}/sessions`)).json();
    await ask.click();
    const side = page.locator('[data-workbench-region="side"]');
    const question = side.locator('[contenteditable="true"]').filter({ hasText: "Discuss this passage" });
    await expect(question).toBeVisible();
    await expect(question).toContainText("About this passage");
    await question.press("End");
    await question.pressSequentially("What should we clarify?");
    await expect(question).toContainText("What should we clarify?");
    const sessionsAfter = await (await request.get(`/v1/projects/${project.id}/sessions`)).json();
    expect(sessionsAfter).toEqual(sessionsBefore);
  } finally {
    await request.delete(`/v1/projects/${project.id}`).catch(() => undefined);
    rmSync(root, { recursive: true, force: true });
  }
});
