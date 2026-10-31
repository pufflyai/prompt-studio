import { expect, test } from "bun:test";
import { markdownSessionFixture } from "./markdown-session.test-fixture";
import { createMarkdownSessionDocument } from "./markdown-session-document";

test("a public session drains queued rendered edits before receiving a remote snapshot", async () => {
  const f = await markdownSessionFixture();
  let queued: string | undefined;
  const binding = createMarkdownSessionDocument(f.session, () => {
    if (!queued) return;
    const value = queued;
    queued = undefined;
    binding.write(value);
  });
  try {
    queued = "source LOCAL";
    f.remote((text) => text.insert(0, "REMOTE "));
    await f.session.flush();
    expect(binding.text.toString()).toBe("REMOTE source LOCAL");
    expect(f.document.getText("content").toString()).toBe("REMOTE source LOCAL");
  } finally {
    binding.destroy();
    await f.dispose();
  }
});

test("public composition stays tentative and promotes once without waiting for a host acknowledgement", async () => {
  const f = await markdownSessionFixture();
  const binding = createMarkdownSessionDocument(f.session);
  try {
    binding.setComposing(true);
    binding.write("source 編");
    expect(f.session.getSnapshot().text.toString()).toBe("source");
    expect(f.frames).toHaveLength(0);
    f.remote((text) => text.insert(0, "REMOTE "));
    binding.write("source 編集");
    binding.setComposing(false);
    expect(binding.text.toString()).toBe("REMOTE source 編集");
    expect(f.session.getSnapshot().text.toString()).toBe("REMOTE source 編集");
    binding.undo();
    expect(binding.text.toString()).toBe("REMOTE source");
    binding.redo();
    expect(binding.text.toString()).toBe("REMOTE source 編集");
    await f.session.flush();
    expect(f.document.getText("content").toString()).toBe("REMOTE source 編集");
  } finally {
    binding.destroy();
    await f.dispose();
  }
});

test("an ordinary public close keeps active composition until it finishes", async () => {
  const f = await markdownSessionFixture();
  const binding = createMarkdownSessionDocument(f.session);
  try {
    binding.setComposing(true);
    binding.write("source 編集");
    await expect(f.session.close()).rejects.toMatchObject({ code: "draft_active" });
    expect(binding.text.toString()).toBe("source 編集");
    binding.setComposing(false);
    await f.session.close();
    expect(f.document.getText("content").toString()).toBe("source 編集");
  } finally {
    binding.destroy();
    await f.dispose();
  }
});

test("a public session mutation outside the renderer is reflected in rendered source", async () => {
  const f = await markdownSessionFixture();
  const binding = createMarkdownSessionDocument(f.session);
  try {
    f.session.transact((text) => text.insert(0, "external "));
    expect(binding.text.toString()).toBe("external source");
    await f.session.flush();
  } finally {
    binding.destroy();
    await f.dispose();
  }
});

test("composition across a public history change retains its original draft through uncertain admission", async () => {
  const f = await markdownSessionFixture();
  const binding = createMarkdownSessionDocument(f.session);
  binding.setComposing(true);
  binding.write("source 編集");
  await f.replace("replacement");
  expect(f.session.getSnapshot().text.toString()).toBe("replacement");
  f.rejectDraft("source_unavailable");
  try {
    await expect(binding.setComposing(false)).rejects.toMatchObject({ code: "source_unavailable" });
    expect(binding.isFinishing()).toBe(true);
    expect(binding.text.toString()).toBe("source 編集");
    expect(f.session.getSnapshot().text.toString()).toBe("replacement");
    expect(binding.cancelComposition()).toBe(false);
    expect(binding.text.toString()).toBe("source 編集");
    await expect(binding.retry()).rejects.toMatchObject({ code: "source_unavailable" });
    expect(f.draftOpens).toHaveLength(2);
    expect(f.draftOpens[1]).toEqual(f.draftOpens[0]);
    expect(f.frames).toHaveLength(0);
  } finally {
    f.rejectDraft("source_retired");
    await expect(binding.retry()).rejects.toMatchObject({ code: "source_retired" });
    binding.destroy();
    await f.dispose();
  }
});

test("read-only withdrawal keeps composition tentative instead of creating a refused ordinary frame", async () => {
  const f = await markdownSessionFixture();
  const binding = createMarkdownSessionDocument(f.session);
  binding.setComposing(true);
  binding.write("source 編集");
  f.readonly();
  const finishing = binding.setComposing(false);
  try {
    expect(f.session.getSnapshot().text.toString()).toBe("source");
    await expect(finishing).rejects.toMatchObject({ code: "source_read_only" });
    expect(binding.text.toString()).toBe("source 編集");
    expect(f.frames).toHaveLength(0);
    expect(binding.cancelComposition()).toBe(true);
    expect(binding.text.toString()).toBe("source");
    expect(f.session.getSnapshot().pending).toBe(false);
  } finally {
    await Promise.resolve(finishing).catch(() => {});
    binding.destroy();
    await f.dispose();
  }
});

test("closing retains composition until a second replacement receipt is visible in the public parent", async () => {
  const f = await markdownSessionFixture();
  const binding = createMarkdownSessionDocument(f.session);
  binding.setComposing(true);
  binding.write("source 編集");
  await f.replace("parent history");
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  f.holdDraft(async () => {
    entered.resolve();
    await release.promise;
  });
  const finishing = binding.setComposing(false);
  await entered.promise;
  const visible: string[] = [];
  binding.subscribe((source) => visible.push(source));
  const closing = f.session.close();
  expect(f.session.getSnapshot().closing).toBe(true);
  await f.replace("canonical saved 編集", false);
  release.resolve();
  try {
    await finishing;
    await closing;
    expect(visible).toEqual(["canonical saved 編集"]);
    expect(binding.isFinishing()).toBe(false);
  } finally {
    release.resolve();
    binding.destroy();
    await f.dispose();
  }
});

test("a queued composition finish cannot be discarded before its original commit starts", async () => {
  const f = await markdownSessionFixture();
  const binding = createMarkdownSessionDocument(f.session);
  binding.setComposing(true);
  binding.write("source 編集");
  await f.replace("replacement");
  f.rejectDraft("source_retired");
  const finishing = binding.setComposing(false);
  try {
    expect(binding.cancelComposition()).toBe(false);
    expect(binding.text.toString()).toBe("source 編集");
    await expect(finishing).rejects.toMatchObject({ code: "source_retired" });
    expect(f.draftOpens).toHaveLength(1);
  } finally {
    await Promise.resolve(finishing).catch(() => {});
    binding.destroy();
    await f.dispose();
  }
});

test("an acknowledged composition keeps its preview through failed cleanup and held parent adoption", async () => {
  const f = await markdownSessionFixture();
  const binding = createMarkdownSessionDocument(f.session);
  binding.setComposing(true);
  binding.write("source 編集");
  await f.replace("parent history");
  const entered = Promise.withResolvers<void>();
  const releaseDraft = Promise.withResolvers<void>();
  const releaseParent = Promise.withResolvers<void>();
  f.holdDraft(async () => {
    entered.resolve();
    await releaseDraft.promise;
  });
  f.failDraftCleanup();
  const finishing = binding.setComposing(false);
  await entered.promise;
  await f.replace("canonical saved 編集", false);
  f.holdParent(() => releaseParent.promise);
  releaseDraft.resolve();
  try {
    await expect(finishing).rejects.toMatchObject({ code: "source_unavailable" });
    expect(f.session.getSnapshot().text.toString()).toBe("parent history");
    expect(binding.cancelComposition()).toBe(false);
    expect(binding.text.toString()).toBe("source 編集");
    const retry = binding.retry();
    releaseParent.resolve();
    await retry;
    expect(binding.text.toString()).toBe("canonical saved 編集");
    expect(f.draftOpens).toHaveLength(1);
  } finally {
    releaseParent.resolve();
    releaseDraft.resolve();
    await Promise.resolve(finishing).catch(() => {});
    binding.destroy();
    await f.dispose();
  }
});

test("recovery publication cannot cancel a finish before its work is owned", async () => {
  const f = await markdownSessionFixture();
  const binding = createMarkdownSessionDocument(f.session);
  binding.setComposing(true);
  binding.write("source 編集");
  await f.replace("replacement");
  f.rejectDraft("source_retired");
  const attempts: boolean[] = [];
  binding.subscribeRecovery(() => attempts.push(binding.cancelComposition()));
  const finishing = binding.setComposing(false);
  try {
    expect(attempts).toEqual([false]);
    await expect(finishing).rejects.toMatchObject({ code: "source_retired" });
    expect(binding.text.toString()).toBe("source 編集");
  } finally {
    await Promise.resolve(finishing).catch(() => {});
    binding.destroy();
    await f.dispose();
  }
});
