import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { commands } from "./commands";
import { draftChapterFor } from "./forms";
import { serializeBook } from "./model";
import { bookFixture } from "./model.fixture";
import { type Draft, type Finding, listRecords, readRecord, type Suggestion, saveRecord } from "./records";

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

test.each([
  "rule",
  "finding",
] as const)("invalid references leave a %s draft editable before and after reservation", async (mode) => {
  const storage = createMemoryStorage();
  const workspaceId = "workspace";
  const chapter = 1;
  const draftChapter = draftChapterFor(mode, chapter);
  const referenceField = mode === "rule" ? "related" : "requirements";
  const kind = mode === "rule" ? "suggestion" : "finding";
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
    kind: "violation",
    explanation: "Cover the finding owner with the same retained values.",
    [referenceField]: "RB 999.A.1",
  };
  await commands["drafts.save"].run(ctx, { workspaceId, chapter: draftChapter, values: input });
  const recordId = `${workspaceId}-${draftChapter}`;
  const { record } = await readRecord<Draft>(storage, "draft", recordId);
  const draft = { workspaceId, chapter, mode, expectedRevision: record.revision };
  if (mode === "rule") {
    for (const fields of [{ title: undefined }, { statement: undefined }, { title: 42 }, { statement: "   " }]) {
      await expect(commands["drafts.submit"].run(ctx, { ...draft, values: { ...input, ...fields } })).rejects.toThrow();
    }
    expect((await readRecord<Draft>(storage, "draft", recordId)).record.revision).toBe(record.revision);
  }
  await expect(commands["drafts.submit"].run(ctx, { ...draft, values: input })).resolves.toMatchObject({
    refused: { reason: expect.stringContaining("RB 999.A.1"), revision: record.revision },
  });
  expect((await readRecord<Draft>(storage, "draft", recordId)).value).toMatchObject({ values: input });
  expect((await readRecord<Draft>(storage, "draft", recordId)).value?.submissionStatus).toBeUndefined();
  expect(await listRecords(storage, kind)).toHaveLength(0);
  const corrected = { ...input, [referenceField]: "RB 1.A.1" };
  readsBeforeRemoval = 2;
  const result = await commands["drafts.submit"].run(ctx, { ...draft, values: corrected });
  const restored = await readRecord<Draft>(storage, "draft", recordId);
  expect(restored.record.revision).not.toBe(record.revision);
  expect(result).toMatchObject({
    refused: { reason: expect.stringContaining("RB 1.A.1"), revision: restored.record.revision },
  });
  expect(restored.value).toMatchObject({ values: corrected });
  expect(restored.value?.submissionStatus).toBeUndefined();
  expect(await listRecords(storage, kind)).toHaveLength(0);
  await commands["drafts.submit"].run(ctx, {
    ...draft,
    expectedRevision: restored.record.revision,
    values: { ...corrected, [referenceField]: "RB 1.A.2" },
  });
  const effects = await listRecords<Finding | Suggestion>(storage, kind);
  expect(effects).toHaveLength(1);
  const effect = effects[0]!;
  expect("operations" in effect ? effect.operations[0]?.after?.related : effect.requirements).toEqual(["RB 1.A.2"]);
});

test.each([
  true,
  false,
])("a racing submission check accepts only the same confirmed chapter draft (%s)", async (same) => {
  const original = createMemoryStorage();
  const workspaceId = "workspace";
  const chapter = draftChapterFor("chapter", 1);
  const submissionId = "submitted-chapter";
  const draft = {
    id: `${workspaceId}-${chapter}`,
    workspaceId,
    chapter,
    values: { title: "My chapter", group: "Core" },
    submissionId,
    submissionStatus: "writing",
  } satisfies Draft;
  await saveRecord(original, "draft", draft);
  let reading = 0;
  const storage = {
    ...original,
    records: {
      ...original.records,
      async read(id: Parameters<typeof original.records.read>[0]) {
        if (++reading === 2) {
          await saveRecord(original, "draft", {
            ...draft,
            submissionId: same ? submissionId : "other-submission",
            submissionStatus: "confirmed",
          });
        }
        return original.records.read(id);
      },
    },
  };
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
    },
  });
  const check = commands["drafts.check-submission"].run(ctx, { workspaceId, chapter, submissionId });
  if (same) await expect(check).resolves.toEqual({ confirmed: true });
  else await expect(check).rejects.toThrow("The record changed. Reload before saving.");
  expect((await readRecord<Draft>(original, "draft", draft.id)).value?.submissionStatus).toBe("confirmed");
});
