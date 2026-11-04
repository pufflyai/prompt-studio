import { expect, test } from "bun:test";
import { textEditingSessionFixture } from "./text-editing-session.test-fixture";

test("a draft recovery echoes its admitted generation before it can join canonical history", async () => {
  const f = await textEditingSessionFixture(true, "admitted");
  try {
    const draft = f.session.createDraft();
    draft.text.insert(draft.text.length, " private draft");
    await draft.commit();
    expect(f.document.getText("content").toString()).toBe("source private draft");
    await f.session.close();
  } finally {
    f.document.destroy();
  }
});

test("a same-seed snapshot from a new replica generation leaves the old editor and draft recoverable", async () => {
  const f = await textEditingSessionFixture(true, "admitted");
  try {
    const earlier = await f.snapshot();
    const draft = f.session.createDraft();
    draft.text.insert(draft.text.length, " preserved private draft");
    f.document.getText("content").insert(0, "new canonical ");
    f.setGeneration("after-refusal");
    f.emit({ type: "snapshot", version: 1, snapshot: await f.snapshot() });
    expect(f.session.getSnapshot().text.toString()).toBe("source");
    expect(f.session.getSnapshot().error).toMatchObject({ code: "source_retired", retryable: false });
    expect(draft.text.toString()).toBe("source preserved private draft");
    f.emit({ type: "snapshot", version: 2, snapshot: earlier });
    expect(f.session.getSnapshot().error).toMatchObject({ code: "source_retired" });
    expect(() => f.session.transact((text) => text.insert(0, "stale"))).toThrow();
  } finally {
    f.document.destroy();
  }
});

test("a generation change before acknowledgement preserves the admitted SDK batch as pending", async () => {
  const f = await textEditingSessionFixture(true, "admitted");
  try {
    f.beforeAck(() => f.setGeneration("after-refusal"));
    f.session.transact((text) => text.insert(0, "retained "));
    await expect(f.session.flush()).rejects.toMatchObject({ code: "source_retired" });
    expect(f.session.getSnapshot().pending).toBe(true);
    expect(f.session.getSnapshot().text.toString()).toBe("retained source");
    expect(f.frames).toHaveLength(1);
  } finally {
    f.document.destroy();
  }
});
