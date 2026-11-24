import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { acknowledgeSavedDraft, recoverSavedDraft } from "./draft-recovery";
import { watchConversation } from "./watch";
import { createWatchObservationFixture } from "./watch-observation.test-fixture";

const savedDraft = {
  text: "Work saved before the upgrade",
  attachments: [{ id: "saved-file", name: "notes.txt" }],
  values: { harness: { harnessId: "agent", model: "chosen" } },
};
const seedDraft = async (draft: unknown) => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const bytes = new TextEncoder().encode(JSON.stringify(draft));
  const file = await storage.files.put({ name: "draft-saved.json", mimeType: "application/json", data: bytes });
  const recordId = storage.records.id("draft:saved");
  await storage.records.commit({
    operationId: storage.ids.create(),
    edits: [{ recordId, replace: { fileId: file.id } }],
  });
  return { ctx, storage, bytes, file, recordId };
};

test("an acknowledged provider draft is offered to its browser after upgrading to local drafts", async () => {
  const controller = new AbortController();
  const events: unknown[] = [];
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      signal: controller.signal,
      stream: {
        write: async (event) => {
          events.push(event);
        },
      },
    },
  });
  const draft = {
    text: "Work saved before the upgrade",
    attachments: [{ id: "saved-file", name: "notes.txt" }],
    values: { harness: { harnessId: "agent", model: "chosen" } },
  };
  const file = await ctx.storage.files.put({
    name: "draft-saved.json",
    mimeType: "application/json",
    data: new TextEncoder().encode(JSON.stringify(draft)),
  });
  const recordId = ctx.storage.records.id("draft:saved");
  await ctx.storage.records.commit({
    operationId: ctx.storage.ids.create(),
    edits: [{ recordId, replace: { fileId: file.id } }],
  });
  const watching = watchConversation(ctx, { type: "session-draft", id: "saved" }, "new-browser", "saved");
  try {
    await Bun.sleep(0);
  } finally {
    controller.abort();
    await watching;
  }
  expect(events).toContainEqual(expect.objectContaining({ recoverDraft: draft }));
  expect((await ctx.storage.records.read(recordId)).exists).toBe(true);
  expect(JSON.parse(new TextDecoder().decode(await ctx.storage.files.getBytes(file.id)))).toEqual(draft);
});

test("a provider recovery receipt requires every saved body and keeps the original record and bytes", async () => {
  const earlier = { text: "Earlier work", attachments: [], values: { model: "previous" } };
  const original = { text: "", attachments: [], values: {}, recovered: [savedDraft, earlier] };
  const { ctx, storage, recordId, file, bytes } = await seedDraft(original);
  await acknowledgeSavedDraft(ctx, "saved", savedDraft);
  expect(await recoverSavedDraft(ctx, "saved")).toEqual(original);
  await acknowledgeSavedDraft(ctx, "saved", { ...savedDraft, recovered: [earlier] });
  expect(await recoverSavedDraft(ctx, "saved")).toBeUndefined();
  expect((await storage.records.read(recordId)).exists).toBe(true);
  expect(await storage.files.getBytes(file.id)).toEqual(bytes);
});

test("an old provider can rewrite its blob during recovery acknowledgement without losing the new draft", async () => {
  const { ctx, storage, file } = await seedDraft(savedDraft);
  const newer = { ...savedDraft, text: "New work from the older client" };
  const commit = storage.records.commitIfCurrent.bind(storage.records);
  storage.records.commitIfCurrent = async (input) => {
    await storage.files.update(file.id, {
      name: file.name,
      mimeType: "application/json",
      data: new TextEncoder().encode(JSON.stringify(newer)),
    });
    return commit(input);
  };
  await acknowledgeSavedDraft(ctx, "saved", savedDraft);
  expect(await recoverSavedDraft(ctx, "saved")).toEqual(newer);
});

test("a provider replacing its pointer during acknowledgement keeps the replacement recoverable", async () => {
  const { ctx, storage, recordId, file, bytes } = await seedDraft(savedDraft);
  const newer = { ...savedDraft, text: "Replacement pointer" };
  const replacement = await storage.files.put({
    name: "replacement.json",
    mimeType: "application/json",
    data: new TextEncoder().encode(JSON.stringify(newer)),
  });
  const commit = storage.records.commitIfCurrent.bind(storage.records);
  storage.records.commitIfCurrent = async (input) => {
    await storage.records.commit({
      operationId: storage.ids.create(),
      edits: [{ recordId, replace: { fileId: replacement.id } }],
    });
    return commit(input);
  };
  await acknowledgeSavedDraft(ctx, "saved", savedDraft);
  expect(await recoverSavedDraft(ctx, "saved")).toEqual(newer);
  expect(await storage.files.getBytes(file.id)).toEqual(bytes);
});

test.each([
  null,
  { ...savedDraft, recovered: [null] },
])("a corrupt old draft stays recoverable instead of being consumed", async (draft) => {
  const { ctx, storage, recordId, file, bytes } = await seedDraft(draft);
  await expect(recoverSavedDraft(ctx, "saved")).rejects.toThrow("The saved draft needs recovery");
  await expect(acknowledgeSavedDraft(ctx, "saved", savedDraft)).rejects.toThrow("The saved draft needs recovery");
  expect((await storage.records.read(recordId)).value).toEqual({ fileId: file.id });
  expect(await storage.files.getBytes(file.id)).toEqual(bytes);
});

test("a corrupt provider draft reports recovery trouble while the session stream connects", async () => {
  const fixture = createWatchObservationFixture();
  const { storage } = fixture.ctx;
  const file = await storage.files.put({
    name: "draft-saved.json",
    mimeType: "application/json",
    data: new TextEncoder().encode("null"),
  });
  const recordId = storage.records.id("draft:saved");
  await storage.records.commit({
    operationId: storage.ids.create(),
    edits: [{ recordId, replace: { fileId: file.id } }],
  });
  const watching = watchConversation(fixture.ctx, { type: "session", id: "s" }, "browser", "saved");
  try {
    await Promise.race([fixture.connected, watching]);
    expect(fixture.counts.stream).toBe(1);
    expect(fixture.frames).toContainEqual(
      expect.objectContaining({
        snapshot: expect.objectContaining({ notice: expect.stringContaining("saved draft") }),
      }),
    );
    expect((await storage.records.read(recordId)).value).toEqual({ fileId: file.id });
  } finally {
    fixture.controller.abort();
    await watching;
  }
});
