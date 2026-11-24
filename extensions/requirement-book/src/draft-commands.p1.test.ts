import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { commands } from "./commands";
import { serializeBook } from "./model";
import { bookFixture } from "./model.fixture";
import { type Draft, listRecords, readRecord, type Suggestion } from "./records";

test("authoring writes persist the exact submitted draft in its own workspace and chapter", async () => {
  const storage = createMemoryStorage();
  const workspaces = ["first", "second"].map((id) => ({
    id,
    rootPath: "/workspace",
    providerState: "ready",
    executionKind: "local",
    capabilities: { files: "write" },
  }));
  const [ctx] = makeCommandArgs({
    storage,
    params: {},
    overrides: {
      projectId: "project",
      workspaces: {
        getDefault: async () => workspaces[0],
        get: async (id: string) => workspaces.find((workspace) => workspace.id === id),
      } as never,
    },
  });
  const chapter = -2;
  const saved = { title: "Other workspace" };
  await commands["drafts.save"].run(ctx, { workspaceId: "second", chapter, values: saved });

  const submitted = { title: "Preserve this finding", explanation: "The source window closed." };
  await commands["drafts.save-editing"].run(ctx, {
    workspaceId: "first",
    chapter,
    operationId: "authoring-edit-one",
    draft: JSON.stringify(submitted),
  });
  expect((await readRecord<Draft>(storage, "draft", "first--2")).value?.values).toEqual(submitted);
  expect((await readRecord<Draft>(storage, "draft", "second--2")).value?.values).toEqual(saved);

  await expect(
    commands["drafts.save-editing"].run(ctx, {
      workspaceId: "first",
      chapter,
      operationId: "bad-edit",
      draft: "[]",
    }),
  ).rejects.toThrow();
  expect((await readRecord<Draft>(storage, "draft", "first--2")).value?.values).toEqual(submitted);

  const newer = { title: "A later edit from another editor" };
  await commands["drafts.save"].run(ctx, { workspaceId: "first", chapter, values: newer });
  const recovered = await commands["drafts.save-editing"].run(ctx, {
    workspaceId: "first",
    chapter,
    operationId: "authoring-edit-one",
    draft: JSON.stringify(submitted),
  });
  const current = await readRecord<Draft>(storage, "draft", "first--2");
  expect(current.value?.values).toEqual(newer);
  expect(recovered).toEqual({ value: { draft: JSON.stringify(newer), revision: current.record.revision } });
});

test("invalid references leave a rule draft editable and corrected input can create its suggestion", async () => {
  const storage = createMemoryStorage();
  const workspaceId = "workspace";
  const chapter = 1;
  let readsBeforeRemoval: number | undefined;
  const [ctx] = makeCommandArgs({
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
      process: {
        run: async ({ command }) => {
          if (command[1] !== "diff") return { exitCode: 0, stderr: "", stdout: "working\n" };
          const book = bookFixture();
          if (readsBeforeRemoval !== undefined && --readsBeforeRemoval <= 0)
            book.rules = book.rules.filter((rule) => rule.ref !== "RB 1.A.1");
          const addition = serializeBook(book)
            .trimEnd()
            .split("\n")
            .map((line) => `+${line}`)
            .join("\n");
          return { exitCode: 1, stderr: "", stdout: `@@\n${addition}` };
        },
      },
    },
  });
  const input = {
    title: "Keep the draft editable",
    statement: "Keep authoring input when validation refuses it.",
    reason: "Cover authoring recovery.",
    acceptance: "The same draft can be edited and submitted.",
    related: "RB 999.A.1",
  };
  await commands["drafts.save"].run(ctx, { workspaceId, chapter, values: input });
  const recordId = `${workspaceId}-${chapter}`;
  const { record } = await readRecord<Draft>(storage, "draft", recordId);
  const draft = { workspaceId, chapter, mode: "rule", expectedRevision: record.revision };
  await expect(commands["drafts.submit"].run(ctx, { ...draft, values: input })).resolves.toMatchObject({
    refused: { reason: expect.stringContaining("RB 999.A.1"), revision: record.revision },
  });
  expect((await readRecord<Draft>(storage, "draft", recordId)).value).toMatchObject({ values: input });
  expect((await readRecord<Draft>(storage, "draft", recordId)).value?.submissionStatus).toBeUndefined();
  expect(await listRecords<Suggestion>(storage, "suggestion")).toHaveLength(0);
  const corrected = { ...input, related: "RB 1.A.1" };
  readsBeforeRemoval = 2;
  const result = await commands["drafts.submit"].run(ctx, { ...draft, values: corrected });
  const restored = await readRecord<Draft>(storage, "draft", recordId);
  expect(restored.record.revision).not.toBe(record.revision);
  expect(result).toMatchObject({
    refused: { reason: expect.stringContaining("RB 1.A.1"), revision: restored.record.revision },
  });
  expect(restored.value).toMatchObject({ values: corrected });
  expect(restored.value?.submissionStatus).toBeUndefined();
  expect(await listRecords<Suggestion>(storage, "suggestion")).toHaveLength(0);
  await commands["drafts.submit"].run(ctx, {
    ...draft,
    expectedRevision: restored.record.revision,
    values: { ...corrected, related: "RB 1.A.2" },
  });
  expect((await listRecords<Suggestion>(storage, "suggestion"))[0]?.operations[0]?.after?.related).toEqual([
    "RB 1.A.2",
  ]);
});
