import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket, executePlannerCommand } from "../helpers/planner-api";
import { nativePublicTextEditor } from "../helpers/verify-public-text-editor";
import { expect, test } from "../scripts/session-test";
import { uiOrigin } from "../ui-server";

// Critical: a passage action must let the person author a comment without losing its selection.
test("selected text opens an editable comment popover and publishes the authored text", async ({ page, request }) => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-selection-comments-"));
  const created = await request.post("/v1/projects", { data: folderProjectInput({ name: "Passage comments" }, root) });
  expect(created.ok()).toBe(true);
  const project = await created.json();
  try {
    const passage = "Discuss this passage";
    const body = `${passage} before changing it.`;
    const ticket = await createPlannerTicket(request, uiOrigin, project.id, {
      content: `# Review this passage\n\n${body}`,
    });
    const link = await executePlannerCommand<{ href: string }>(request, uiOrigin, project.id, "document-link", {
      id: ticket.id,
    });
    await page.goto(link.href);
    const editor = nativePublicTextEditor(page);
    await expect(editor).toContainText(body);
    const selectPassage = async () => {
      await editor.focus();
      await editor.evaluate((element, textToSelect) => {
        const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let text = walker.nextNode();
        while (text && !text.textContent?.includes(textToSelect)) text = walker.nextNode();
        if (!text) throw new Error(`Passage unavailable: ${textToSelect}`);
        const start = text.textContent!.indexOf(textToSelect);
        const range = element.ownerDocument.createRange();
        range.setStart(text, start);
        range.setEnd(text, start + textToSelect.length);
        const selection = element.ownerDocument.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
      }, passage);
    };
    await selectPassage();
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
    await expect(activity).toContainText(passage);
    await expect(editor).toContainText(body);

    // A thread reply must never consume or redirect the independent top-level draft.
    const thread = activity.locator("article[data-activity-entry]").filter({
      has: page.getByText("Clarify the retry behavior.", { exact: true }),
    });
    await expect(thread).toBeVisible();
    const commentInput = activity.getByRole("textbox", { name: "Leave a comment…", exact: true });
    await commentInput.fill("Keep my top-level draft.");
    await thread.getByRole("button", { name: "Leave a reply…", exact: true }).click();
    const replyInput = thread.getByRole("textbox", { name: "Leave a reply…", exact: true });
    await expect(replyInput).toBeFocused();
    await replyInput.fill("Clarify the timeout budget.");
    const receivedReply = Promise.withResolvers<void>();
    const releaseReply = Promise.withResolvers<void>();
    await page.route(
      "**/activity/publish",
      async (route) => {
        receivedReply.resolve();
        await releaseReply.promise;
        await route.fulfill({ status: 503, json: { error: "Temporarily unavailable" } });
      },
      { times: 1 },
    );
    await thread.getByRole("button", { name: "Submit reply", exact: true }).click();
    await receivedReply.promise;
    try {
      await expect(commentInput).toBeEditable();
      await commentInput.fill("Independent top-level draft.");
    } finally {
      releaseReply.resolve();
    }
    await expect(thread.getByRole("alert")).toBeVisible();
    await expect(replyInput).toHaveText("Clarify the timeout budget.");
    await expect(commentInput).toHaveText("Independent top-level draft.");
    await thread.getByRole("button", { name: "Submit reply", exact: true }).click();
    await expect(thread.getByText("Clarify the timeout budget.", { exact: true })).toBeVisible();
    await expect(thread.getByRole("button", { name: "Leave a reply…", exact: true })).toBeVisible();
    await expect(commentInput).toHaveText("Independent top-level draft.");
    await activity.getByRole("button", { name: "Submit comment", exact: true }).click();
    await expect(activity.locator("article[data-activity-entry]")).toHaveCount(2);
    await expect(thread.getByText("Independent top-level draft.", { exact: true })).toHaveCount(0);

    await selectPassage();
    const ask = toolbar.getByRole("button", { name: "Ask agent", exact: true });
    await expect(ask).toBeVisible();
    const sessionsBefore = await (await request.get(`/v1/projects/${project.id}/sessions`)).json();
    await ask.click();
    const side = page.locator('[data-workbench-region="side"]');
    const question = side.locator('[contenteditable="true"]').filter({ hasText: passage });
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
