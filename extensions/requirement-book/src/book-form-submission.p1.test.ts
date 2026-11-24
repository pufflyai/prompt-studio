import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { submitBookForm } from "./book-form-submission";
import { draftCommands, submitDraft } from "./draft-commands";
import { type Draft, readRecord } from "./records";

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
  const args = () =>
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
