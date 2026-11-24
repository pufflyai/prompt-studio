import { createHash } from "node:crypto";
import type { ChatDraft, ExtensionContextBase } from "@pstdio/sdk/extensions";

const contentKey = (draft: ChatDraft) =>
  JSON.stringify({ text: draft.text, attachments: draft.attachments, values: draft.values });
const hasContent = (draft: ChatDraft) =>
  Boolean(draft.text || draft.attachments.length || Object.keys(draft.values).length);
const validContent = (draft: ChatDraft) =>
  draft &&
  typeof draft.text === "string" &&
  Array.isArray(draft.attachments) &&
  draft.values &&
  typeof draft.values === "object" &&
  !Array.isArray(draft.values);

const readSavedDraft = async (ctx: ExtensionContextBase, key: string) => {
  const record = await ctx.storage.records.read(ctx.storage.records.id(`draft:${key}`));
  if (!record.exists || record.deleted) return;
  const pointer = record.value as { fileId?: unknown; recoveredDraftHash?: unknown };
  if (!pointer || typeof pointer.fileId !== "string")
    throw new Error("The saved draft needs recovery. Its record has been kept.");
  const bytes = await ctx.storage.files.getBytes(pointer.fileId);
  const draft = JSON.parse(new TextDecoder().decode(bytes)) as ChatDraft;
  if (
    !validContent(draft) ||
    (draft.recovered !== undefined && (!Array.isArray(draft.recovered) || !draft.recovered.every(validContent)))
  )
    throw new Error("The saved draft needs recovery. Its file has been kept.");
  const hash = createHash("sha256").update(bytes).digest("hex");
  return { record, pointer, draft, hash };
};

/** Old provider drafts have no browser owner; retain their source until a browser confirms its durable copy. */
export const recoverSavedDraft = async (ctx: ExtensionContextBase, key: string) => {
  const saved = await readSavedDraft(ctx, key);
  if (!saved || saved.pointer.recoveredDraftHash === saved.hash) return;
  if ([saved.draft, ...(saved.draft.recovered ?? [])].some(hasContent)) return saved.draft;
};

export const acknowledgeSavedDraft = async (ctx: ExtensionContextBase, key: string, draft: ChatDraft) => {
  const saved = await readSavedDraft(ctx, key);
  if (!saved || saved.pointer.recoveredDraftHash === saved.hash) return;
  const durable = new Set([draft, ...(draft.recovered ?? [])].map(contentKey));
  if (
    ![saved.draft, ...(saved.draft.recovered ?? [])].filter(hasContent).every((part) => durable.has(contentKey(part)))
  )
    return;
  // Keep the old record and bytes. An older provider can still update the same file;
  // a content receipt must not hide that newer body or delete its recovery source.
  await ctx.storage.records.commitIfCurrent({
    operationId: ctx.storage.ids.create(),
    edits: [
      {
        recordId: saved.record.recordId,
        expectedRevision: saved.record.revision,
        set: { "/recoveredDraftHash": saved.hash },
      },
    ],
  });
};
