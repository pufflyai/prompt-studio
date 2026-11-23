import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { commands } from "./commands";
import { type Draft, readRecord } from "./records";

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
  expect((await readRecord<Draft>(storage, "draft", "first--2")).value?.values).toEqual(newer);
  expect(recovered).toEqual({ value: { draft: JSON.stringify(newer) } });
});
