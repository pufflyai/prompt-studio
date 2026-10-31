import { expect, test } from "bun:test";
import { markdownSessionFixture } from "./markdown-session.test-fixture";
import { createMarkdownSessionDocument } from "./markdown-session-document";
import { createMarkdownTableDraft } from "./markdown-table-draft";

const initial = "| A | B |\n| --- | --- |\n| left | right |";

test("explicit Cancel releases a tentative public table draft without starting recovery or changing its source", async () => {
  const f = await markdownSessionFixture();
  await f.replace(initial);
  const binding = createMarkdownSessionDocument(f.session);
  const edit = createMarkdownTableDraft({ binding, tableIndex: 0, rowIndex: 1, columnIndex: 0, value: "left" });
  try {
    edit.update("cancel this draft");
    expect(edit.cancel()).toBe(true);
    edit.dispose();
    expect(binding.isFinishing()).toBe(false);
    await f.session.close();
    expect(f.document.getText("content").toString()).toBe(initial);
    expect(f.draftOpens).toHaveLength(0);
    expect(f.frames).toHaveLength(0);
  } finally {
    binding.destroy();
    await f.dispose();
  }
});

test("a tentative public table draft blocks close while peer text remains live in the parent", async () => {
  const f = await markdownSessionFixture();
  await f.replace(initial);
  const binding = createMarkdownSessionDocument(f.session);
  const edit = createMarkdownTableDraft({ binding, tableIndex: 0, rowIndex: 1, columnIndex: 0, value: "left" });
  try {
    edit.update("left draft");
    f.remote((text) => text.insert(text.toString().indexOf("right"), "REMOTE "));
    expect(binding.text.toString()).toContain("REMOTE right");
    expect(binding.text.toString()).not.toContain("left draft");
    await expect(f.session.close()).rejects.toMatchObject({ code: "draft_active" });
    edit.commit("left draft");
    edit.dispose();
    await binding.retry();
    expect(binding.text.toString()).toBe("| A | B |\n| --- | --- |\n| left draft | REMOTE right |");
    binding.undo();
    expect(binding.text.toString()).toBe("| A | B |\n| --- | --- |\n| left | REMOTE right |");
    binding.redo();
    expect(binding.text.toString()).toBe("| A | B |\n| --- | --- |\n| left draft | REMOTE right |");
  } finally {
    edit.dispose();
    binding.cancelComposition();
    binding.destroy();
    await f.dispose();
  }
});

test("implicit table dismissal after permission withdrawal retains tentative public text until explicit discard", async () => {
  const f = await markdownSessionFixture();
  await f.replace(initial);
  const binding = createMarkdownSessionDocument(f.session);
  const edit = createMarkdownTableDraft({ binding, tableIndex: 0, rowIndex: 1, columnIndex: 0, value: "left" });
  try {
    edit.update("left draft");
    f.readonly();
    edit.dispose();
    expect(binding.text.toString()).toContain("left draft");
    expect(f.session.getSnapshot().text.toString()).toBe(initial);
    expect(binding.isFinishing()).toBe(true);
    // Tentative drafts are outside the durable submit queue.
    expect(f.session.getSnapshot().pending).toBe(false);
    expect(binding.cancelComposition()).toBe(true);
    await f.session.close();
    expect(f.document.getText("content").toString()).toBe(initial);
  } finally {
    binding.cancelComposition();
    binding.destroy();
    await f.dispose();
  }
});
