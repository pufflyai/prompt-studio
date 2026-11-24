import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { submitBookForm } from "./book-form-submission";
import { draftCommands, settleFailedDraft, submitDraft } from "./draft-commands";
import { type Draft, readRecord, saveRecord } from "./records";

const draftContext = (storage: ReturnType<typeof createMemoryStorage>, workspaceId: string) =>
  makeCommandArgs({
    storage,
    params: {},
    overrides: {
      workspaces: {
        get: async () => ({
          id: workspaceId,
          rootPath: "/workspace",
          providerState: "ready",
          executionKind: "local",
          capabilities: { files: "write" },
        }),
      } as never,
    },
  })[0];

test("confirmed creation closes the form", async () => {
  const stages: string[] = [];
  await submitBookForm({
    persist: async () => {
      stages.push("draft");
    },
    submit: async () => {
      stages.push("create");
    },
    close: () => {
      stages.push("close");
    },
  });
  expect(stages).toEqual(["draft", "create", "close"]);
});

test("an unresolved creation keeps the submitted draft and the form available", async () => {
  const stages: string[] = [];
  await expect(
    submitBookForm({
      persist: async () => {
        stages.push("draft");
      },
      submit: async () => {
        throw new Error("The response was lost");
      },
      close: () => {
        stages.push("close");
      },
    }),
  ).rejects.toThrow("The response was lost");
  expect(stages).toEqual(["draft"]);
});

test("a lost creation response keeps the submitted draft reserved across reopened forms", async () => {
  const storage = createMemoryStorage();
  const workspaceId = "book-workspace";
  const chapter = 3;
  const draftId = `${workspaceId}-${chapter}`;
  const scope = { workspaceId, chapter };
  const values = { title: "Keep this chapter" };
  const args = () => draftContext(storage, workspaceId);
  const entered = Promise.withResolvers<void>();
  const respond = Promise.withResolvers<void>();
  let writes = 0;
  const first = submitDraft(args(), { ...scope, values }, async () => {
    writes++;
    entered.resolve();
    return respond.promise;
  });
  await entered.promise;
  const writing = (await readRecord<Draft>(storage, "draft", draftId)).value!;
  expect(writing.values).toEqual(values);
  expect(writing.submissionStatus).toBe("writing");
  await expect(
    draftCommands["drafts.check-submission"].run(args(), { ...scope, submissionId: writing.submissionId! }),
  ).resolves.toEqual({ confirmed: false });
  expect((await readRecord<Draft>(storage, "draft", draftId)).value?.submissionStatus).toBe("writing");
  await expect(
    draftCommands["drafts.discard"].run(args(), { ...scope, submissionId: writing.submissionId }),
  ).rejects.toThrow("still being written");
  const tryAgain = () =>
    submitDraft(args(), { ...scope, values }, async () => {
      writes++;
    });
  await expect(tryAgain()).rejects.toThrow("still needs to be checked");

  respond.resolve();
  expect((await first).submissionId).toBe(writing.submissionId!);
  const retained = (await readRecord<Draft>(storage, "draft", draftId)).value!;
  expect(retained.submissionStatus).toBe("confirmed");
  await expect(tryAgain()).rejects.toThrow("still needs to be checked");
  expect(writes).toBe(1);
  await expect(draftCommands["drafts.discard"].run(args(), scope)).rejects.toThrow("Reopen");
  await draftCommands["drafts.discard"].run(args(), { ...scope, submissionId: retained.submissionId });
  const newValues = { title: "New chapter" };
  const oldRevision = (await readRecord<Draft>(storage, "draft", draftId)).record.revision;
  await draftCommands["drafts.save"].run(args(), { ...scope, values: newValues });
  await expect(
    draftCommands["drafts.discard"].run(args(), { ...scope, expectedRevision: oldRevision }),
  ).rejects.toThrow("Reopen");
  await expect(
    draftCommands["drafts.discard"].run(args(), { ...scope, submissionId: retained.submissionId }),
  ).rejects.toThrow("Reopen");
  expect((await readRecord<Draft>(storage, "draft", draftId)).value?.values).toEqual(newValues);
});

test("a reopened form can confirm its exact stored result after disconnect without creating again", async () => {
  const storage = createMemoryStorage();
  const workspaceId = "book-workspace";
  const context = draftContext(storage, workspaceId);
  const scope = { workspaceId, chapter: -2 };
  const proof = { kind: "finding" as const, id: "planned-finding" };
  let disconnected = false;
  let writes = 0;
  const transport = {
    ...context,
    storage: {
      ...storage,
      records: {
        ...storage.records,
        read: async (id: Parameters<typeof storage.records.read>[0]) => {
          if (disconnected) throw new Error("The command request was cancelled");
          return storage.records.read(id);
        },
      },
    },
  };
  await expect(
    submitDraft(transport, { ...scope, values: { title: "Keep original" }, proof }, async () => {
      writes++;
      await saveRecord(storage, "finding", { id: proof.id, workspaceId });
      disconnected = true;
    }),
  ).rejects.toThrow("cancelled");
  const pending = (await readRecord<Draft>(storage, "draft", `${workspaceId}--2`)).value!;
  expect(pending.submissionStatus).toBe("writing");
  await expect(
    draftCommands["drafts.check-submission"].run(context, {
      ...scope,
      submissionId: "unrelated",
    }),
  ).resolves.toEqual({ confirmed: false });
  await expect(
    draftCommands["drafts.check-submission"].run(context, {
      ...scope,
      submissionId: pending.submissionId!,
    }),
  ).resolves.toEqual({ confirmed: true });
  expect((await readRecord<Draft>(storage, "draft", `${workspaceId}--2`)).value?.submissionStatus).toBe("confirmed");
  expect(writes).toBe(1);
});

test("only the failed invocation can release an interrupted submission for inspection", async () => {
  const storage = createMemoryStorage();
  const workspaceId = "book-workspace";
  const context = draftContext(storage, workspaceId);
  const scope = { workspaceId, chapter: -3 };
  let disconnected = false;
  const transport = {
    ...context,
    storage: {
      ...storage,
      records: {
        ...storage.records,
        read: async (id: Parameters<typeof storage.records.read>[0]) => {
          if (disconnected) throw new Error("The caller disconnected");
          return storage.records.read(id);
        },
      },
    },
  };
  await expect(
    submitDraft(transport, { ...scope, values: { title: "Retained" }, invocationId: "owner-invocation" }, async () => {
      disconnected = true;
      throw new Error("The write was interrupted");
    }),
  ).rejects.toThrow("disconnected");
  const draftId = `${workspaceId}--3`;
  const pending = (await readRecord<Draft>(storage, "draft", draftId)).value!;
  await settleFailedDraft(context, { ...scope, invocationId: "unrelated" });
  expect((await readRecord<Draft>(storage, "draft", draftId)).value?.submissionStatus).toBe("writing");
  await settleFailedDraft(context, { ...scope, invocationId: "owner-invocation" });
  expect((await readRecord<Draft>(storage, "draft", draftId)).value).toMatchObject({
    submissionStatus: "unconfirmed",
    values: { title: "Retained" },
  });
  await draftCommands["drafts.discard"].run(context, { ...scope, submissionId: pending.submissionId });
  expect((await readRecord<Draft>(storage, "draft", draftId)).value).toBeUndefined();
});

test("checking a reservation left by a stopped runtime preserves the unknown draft until explicit discard", async () => {
  const storage = createMemoryStorage();
  const workspaceId = "stopped-workspace";
  const chapter = -3;
  const id = `${workspaceId}-${chapter}`;
  const scope = { workspaceId, chapter };
  const ctx = draftContext(storage, workspaceId);
  const draft: Draft = {
    id,
    ...scope,
    values: { title: "Preserve submitted values" },
    submissionId: "stopped",
    submissionStatus: "writing",
  };
  await saveRecord(storage, "draft", draft);
  await expect(draftCommands["drafts.check-submission"].run(ctx, { ...scope, submissionId: "other" })).resolves.toEqual(
    { confirmed: false },
  );
  expect((await readRecord<Draft>(storage, "draft", id)).value).toEqual(draft);
  await expect(
    draftCommands["drafts.check-submission"].run(ctx, { ...scope, submissionId: "stopped" }),
  ).resolves.toEqual({ confirmed: false });
  expect((await readRecord<Draft>(storage, "draft", id)).value).toEqual({ ...draft, submissionStatus: "unconfirmed" });
  await expect(draftCommands["drafts.save"].run(ctx, { ...scope, values: {} })).rejects.toThrow(
    "still needs to be checked",
  );
  await draftCommands["drafts.discard"].run(ctx, { ...scope, submissionId: "stopped" });
  expect((await readRecord<Draft>(storage, "draft", id)).value).toBeUndefined();
});

test("a peer edit between the final read and submission reservation refuses the older form", async () => {
  const storage = createMemoryStorage();
  const workspaceId = "book-workspace";
  const context = draftContext(storage, workspaceId);
  const scope = { workspaceId, chapter: -2 };
  const draftId = `${workspaceId}--2`;
  const values = { title: "Original value" };
  const peer = { title: "Peer's newer draft" };
  await draftCommands["drafts.save"].run(context, { ...scope, values });
  const { record } = await readRecord<Draft>(storage, "draft", draftId);
  let writes = 0;
  let interleaved = false;
  const submission = {
    ...context,
    storage: {
      ...storage,
      records: {
        ...storage.records,
        commit: async (group: Parameters<typeof storage.records.commit>[0]) => {
          if (!interleaved) {
            interleaved = true;
            await draftCommands["drafts.save"].run(context, { ...scope, values: peer });
          }
          return storage.records.commit(group);
        },
      },
    },
  };
  await expect(
    submitDraft(submission, { ...scope, values, expectedRevision: record.revision }, async () => {
      writes++;
    }),
  ).rejects.toThrow("record changed");
  expect(writes).toBe(0);
  const current = (await readRecord<Draft>(storage, "draft", draftId)).value;
  expect(current?.values).toEqual(peer);
  expect(current?.submissionStatus).toBeUndefined();
});
