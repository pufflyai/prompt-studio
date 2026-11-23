import { defineCommand, type ExtensionContextBase, l10n, params } from "@pstdio/sdk/extensions";
import { z } from "zod";
import { announce, type Draft, deleteRecord, saveRecord } from "./records";
import { resolveWorkspace } from "./repository";

const draftTitle = l10n("book.draft.save", "Save an authoring draft");
const draftId = (workspaceId: string, chapter: number) => `${workspaceId}-${chapter}`;
const draftValues = z.record(z.string(), z.unknown());
const draftChange = z.object({ path: z.tuple([z.literal("draft")]), value: z.string() });
const draftChanges = z.tuple([draftChange]);

const saveDraft = async (
  ctx: ExtensionContextBase,
  input: { workspaceId?: string; chapter: number; values: Record<string, unknown> },
) => {
  const { workspace } = await resolveWorkspace(ctx, input.workspaceId);
  const draft: Draft = {
    id: draftId(workspace.id, input.chapter),
    workspaceId: workspace.id,
    chapter: input.chapter,
    values: input.values,
  };
  await saveRecord(ctx.storage, "draft", draft);
  await announce(ctx, workspace.id);
  return draft;
};

export const draftCommands = {
  "drafts.save": defineCommand({
    id: "drafts.save",
    title: draftTitle,
    cli: true,
    mutating: true,
    params: {
      workspaceId: params.text(),
      chapter: params.number({ required: true }),
      values: params.json<Record<string, unknown>, { required: true }>({ required: true }),
    },
    run: saveDraft,
  }),
  "drafts.save-editing": defineCommand({
    id: "drafts.save-editing",
    title: draftTitle,
    mutating: true,
    params: {
      workspaceId: params.text({ required: true }),
      chapter: params.number({ required: true }),
      changes: params.json<{ path: string[]; value: unknown }[], { required: true }>({ required: true }),
    },
    async run(ctx, { workspaceId, chapter, changes }) {
      const [change] = draftChanges.parse(changes);
      return saveDraft(ctx, { workspaceId, chapter, values: draftValues.parse(JSON.parse(change.value)) });
    },
  }),
  "drafts.discard": defineCommand({
    id: "drafts.discard",
    title: l10n("book.draft.discard", "Discard an authoring draft"),
    cli: true,
    mutating: true,
    params: { workspaceId: params.text(), chapter: params.number({ required: true }) },
    async run(ctx, input) {
      const { workspace } = await resolveWorkspace(ctx, input.workspaceId);
      await deleteRecord(ctx.storage, "draft", draftId(workspace.id, input.chapter));
      await announce(ctx, workspace.id);
      return { discarded: true };
    },
  }),
};
