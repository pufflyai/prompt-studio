import { defineCommand, type ExtensionContextBase, l10n, params } from "@pstdio/sdk/extensions";
import { z } from "zod";
import { announce, type Draft, deleteRecord, digest, readRecord, saveRecord } from "./records";
import { resolveWorkspace } from "./repository";

const draftTitle = l10n("book.draft.save", "Save an authoring draft");
const draftId = (workspaceId: string, chapter: number) => `${workspaceId}-${chapter}`;
const draftValues = z.record(z.string(), z.unknown());
const editScope = { workspaceId: params.text({ required: true }), chapter: params.number({ required: true }) };
const editingValue = (values: Record<string, unknown> | undefined) => ({ draft: JSON.stringify(values ?? {}) });

const storedEdit = async (ctx: ExtensionContextBase, operationId: string) => {
  const saved = await ctx.storage.records.outcome(operationId);
  if (!saved) return false;
  if (saved.state === "needs-attention" || saved.state === "refused")
    throw new Error("The authoring draft changed. Reload before saving.");
  return true;
};

const saveDraft = async (
  ctx: ExtensionContextBase,
  input: { workspaceId?: string; chapter: number; values: Record<string, unknown> },
  operationId?: string,
) => {
  const { workspace } = await resolveWorkspace(ctx, input.workspaceId);
  const draft: Draft = {
    id: draftId(workspace.id, input.chapter),
    workspaceId: workspace.id,
    chapter: input.chapter,
    values: input.values,
  };
  await saveRecord(ctx.storage, "draft", draft, undefined, operationId);
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
  "drafts.read-editing": defineCommand({
    id: "drafts.read-editing",
    title: draftTitle,
    params: editScope,
    async run(ctx, { workspaceId, chapter }) {
      const { workspace } = await resolveWorkspace(ctx, workspaceId);
      const { value } = await readRecord<Draft>(ctx.storage, "draft", draftId(workspace.id, chapter));
      return { value: editingValue(value?.values), sources: [] };
    },
  }),
  "drafts.save-editing": defineCommand({
    id: "drafts.save-editing",
    title: draftTitle,
    mutating: true,
    params: {
      ...editScope,
      operationId: params.text({ required: true }),
      draft: params.text({ required: true }),
    },
    async run(ctx, { workspaceId, chapter, operationId, draft }) {
      const { workspace } = await resolveWorkspace(ctx, workspaceId);
      const id = digest(["authoring-draft", workspace.id, chapter, operationId]);
      const values = draftValues.parse(JSON.parse(draft));
      if (!(await storedEdit(ctx, id))) {
        try {
          await saveDraft(ctx, { workspaceId: workspace.id, chapter, values }, id);
        } catch (error) {
          if (!(await storedEdit(ctx, id))) throw error;
        }
      }
      // An explicit recovery acknowledges the earlier edit without replacing a newer draft.
      const { value } = await readRecord<Draft>(ctx.storage, "draft", draftId(workspace.id, chapter));
      return { value: editingValue(value?.values) };
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
