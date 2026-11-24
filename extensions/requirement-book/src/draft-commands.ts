import { defineCommand, type ExtensionContextBase, l10n, params } from "@pstdio/sdk/extensions";
import { z } from "zod";
import {
  announce,
  changed,
  type Draft,
  deleteRecord,
  digest,
  readRecord,
  type SubmissionProof,
  saveRecord,
} from "./records";
import { resolveWorkspace } from "./repository";

const draftTitle = l10n("book.draft.save", "Save an authoring draft");
const draftId = (workspaceId: string, chapter: number) => `${workspaceId}-${chapter}`;
const draftValues = z.record(z.string(), z.unknown());
const editScope = { workspaceId: params.text({ required: true }), chapter: params.number({ required: true }) };
const editingValue = (value: Draft | undefined, revision: string) => ({
  draft: JSON.stringify(value?.values ?? {}),
  revision,
});

const storedEdit = async (ctx: ExtensionContextBase, operationId: string) => {
  const saved = await ctx.storage.records.outcome(operationId);
  if (!saved) return false;
  if (saved.state === "needs-attention" || saved.state === "refused")
    throw new Error("The authoring draft changed. Reload before saving.");
  return true;
};

const saveDraft = async (
  ctx: ExtensionContextBase,
  input: { workspaceId?: string; chapter: number; values: Record<string, unknown>; expectedRevision?: string },
  operationId?: string,
) => {
  const { workspace } = await resolveWorkspace(ctx, input.workspaceId);
  const id = draftId(workspace.id, input.chapter);
  const current = await readRecord<Draft>(ctx.storage, "draft", id);
  if (current.value?.submissionId) throw new Error("A submission from this draft still needs to be checked.");
  if (input.expectedRevision !== undefined && input.expectedRevision !== current.record.revision)
    throw new Error("The authoring draft changed. Reload before saving.");
  const draft: Draft = {
    id,
    workspaceId: workspace.id,
    chapter: input.chapter,
    values: input.values,
    ...(operationId ? { editId: operationId } : {}),
  };
  await saveRecord(ctx.storage, "draft", draft, current.record.revision, operationId);
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
      const { value, record } = await readRecord<Draft>(ctx.storage, "draft", draftId(workspace.id, chapter));
      return {
        value: editingValue(value, record.revision),
        sources: [
          {
            id: "authoring-draft",
            read: {
              commandId: `${ctx.extensionId}.command.drafts.read-editing`,
              params: { workspaceId: workspace.id, chapter },
            },
            dependsOn: [changed],
          },
        ],
      };
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
      expectedRevision: params.text(),
    },
    async run(ctx, { workspaceId, chapter, operationId, draft, expectedRevision }) {
      const { workspace } = await resolveWorkspace(ctx, workspaceId);
      const id = digest(["authoring-draft", workspace.id, chapter, operationId]);
      const values = draftValues.parse(JSON.parse(draft));
      if (!(await storedEdit(ctx, id))) {
        try {
          await saveDraft(ctx, { workspaceId: workspace.id, chapter, values, expectedRevision }, id);
        } catch (error) {
          if (!(await storedEdit(ctx, id))) throw error;
        }
      }
      // An explicit recovery acknowledges the earlier edit without replacing a newer draft.
      const { value, record } = await readRecord<Draft>(ctx.storage, "draft", draftId(workspace.id, chapter));
      return {
        value: {
          ...editingValue(value, record.revision),
          ...(value?.editId === id ? { savedDraftRevision: record.revision } : {}),
        },
      };
    },
  }),
  "drafts.check-submission": defineCommand({
    id: "drafts.check-submission",
    title: l10n("book.draft.check", "Check submitted draft"),
    mutating: true,
    params: { ...editScope, submissionId: params.text({ required: true }) },
    async run(ctx, { workspaceId, chapter, submissionId }) {
      const { workspace } = await resolveWorkspace(ctx, workspaceId);
      const current = await readRecord<Draft>(ctx.storage, "draft", draftId(workspace.id, chapter));
      const draft = current.value;
      if (!draft || draft.submissionId !== submissionId) return { confirmed: false };
      if (draft.submissionStatus === "confirmed") return { confirmed: true };
      const proof = draft.submissionProof;
      if (!proof) return { confirmed: false };
      const saved = await readRecord<{ workspaceId: string }>(ctx.storage, proof.kind, proof.id);
      const confirmed = saved.value?.workspaceId === workspace.id;
      if (!confirmed) return { confirmed: false };
      await saveRecord(ctx.storage, "draft", { ...draft, submissionStatus: "confirmed" }, current.record.revision);
      await announce(ctx, workspace.id);
      return { confirmed: true };
    },
  }),
  "drafts.discard": defineCommand({
    id: "drafts.discard",
    title: l10n("book.draft.discard", "Discard an authoring draft"),
    cli: true,
    mutating: true,
    params: {
      workspaceId: params.text(),
      chapter: params.number({ required: true }),
      submissionId: params.text(),
      expectedRevision: params.text(),
    },
    async run(ctx, input) {
      const { workspace } = await resolveWorkspace(ctx, input.workspaceId);
      const id = draftId(workspace.id, input.chapter);
      const { record, value } = await readRecord<Draft>(ctx.storage, "draft", id);
      if (
        value?.submissionId !== input.submissionId ||
        (input.expectedRevision && input.expectedRevision !== record.revision)
      )
        throw new Error("The authoring draft changed. Reopen it before discarding.");
      if (value?.submissionStatus === "writing") throw new Error("This submission is still being written.");
      await deleteRecord(ctx.storage, "draft", id, record.revision);
      await announce(ctx, workspace.id);
      return { discarded: true };
    },
  }),
};

export const settleFailedDraft = async (
  ctx: ExtensionContextBase,
  input: { workspaceId: string; chapter: number; invocationId: string },
) => {
  const { workspace } = await resolveWorkspace(ctx, input.workspaceId);
  const current = await readRecord<Draft>(ctx.storage, "draft", draftId(workspace.id, input.chapter));
  const draft = current.value;
  if (draft?.submissionStatus !== "writing" || draft.submissionInvocationId !== input.invocationId) return;
  await saveRecord(ctx.storage, "draft", { ...draft, submissionStatus: "unconfirmed" }, current.record.revision);
  await announce(ctx, workspace.id);
};

export const submitDraft = async (
  ctx: ExtensionContextBase,
  input: {
    workspaceId: string;
    chapter: number;
    values: Record<string, unknown>;
    expectedRevision?: string;
    proof?: SubmissionProof;
    invocationId?: string;
  },
  write: () => Promise<unknown>,
) => {
  const id = draftId(input.workspaceId, input.chapter);
  const previous = await readRecord<Draft>(ctx.storage, "draft", id);
  if (previous.value?.submissionId) throw new Error("A submission from this draft still needs to be checked.");
  if (input.expectedRevision !== undefined && input.expectedRevision !== previous.record.revision)
    throw new Error("The authoring draft changed. Reload before submitting.");
  const submissionId = ctx.storage.ids.create();
  const draft: Draft = {
    id,
    workspaceId: input.workspaceId,
    chapter: input.chapter,
    values: input.values,
    submissionId,
    submissionStatus: "writing",
    ...(input.invocationId ? { submissionInvocationId: input.invocationId } : {}),
    ...(input.proof ? { submissionProof: input.proof } : {}),
  };
  await saveRecord(ctx.storage, "draft", draft, previous.record.revision);

  const finish = async (outcome: "confirmed" | "unconfirmed") => {
    const current = await readRecord<Draft>(ctx.storage, "draft", id);
    if (current.value?.submissionId !== submissionId) throw new Error("The submitted draft changed.");
    if (current.value.submissionStatus === "confirmed") return;
    await saveRecord(ctx.storage, "draft", { ...current.value, submissionStatus: outcome }, current.record.revision);
    await announce(ctx, input.workspaceId);
  };

  try {
    await write();
  } catch (error) {
    await finish("unconfirmed");
    throw error;
  }
  await finish("confirmed");
  return { submissionId };
};
