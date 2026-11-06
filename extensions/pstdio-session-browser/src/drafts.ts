import type { ChatDraft, ExtensionContextBase } from "@pstdio/sdk/extensions";

export const emptyDraft = (): ChatDraft => ({ text: "", attachments: [], values: {} });
const filePointer = (value: unknown) =>
  value && typeof value === "object" && "fileId" in value && typeof value.fileId === "string"
    ? value.fileId
    : undefined;
const keyFor = (key: string) => `draft:${key}`;
export const readDraft = async (ctx: ExtensionContextBase, key: string): Promise<ChatDraft> => {
  const pointer = await ctx.storage.records.read(ctx.storage.records.id(keyFor(key)));
  if (!pointer.exists) return emptyDraft();
  const fileId = filePointer(pointer.value);
  if (typeof fileId !== "string") throw new Error("The saved draft needs recovery. Its record has been kept.");
  const draft = JSON.parse(new TextDecoder().decode(await ctx.storage.files.getBytes(fileId))) as ChatDraft;
  if (typeof draft.text !== "string" || !Array.isArray(draft.attachments) || !draft.values)
    throw new Error("The saved draft needs recovery. Its file has been kept.");
  return draft;
};
export const saveDraft = async (ctx: ExtensionContextBase, key: string, draft: ChatDraft) => {
  const recordId = ctx.storage.records.id(keyFor(key));
  const pointer = await ctx.storage.records.read(recordId);
  const previousFile = pointer.exists ? filePointer(pointer.value) : undefined;
  const input = {
    name: `draft-${encodeURIComponent(key)}.json`,
    mimeType: "application/json",
    data: new TextEncoder().encode(JSON.stringify(draft)),
  };
  // Bodies live in scoped blob storage, so a large or cloud-only draft needs no project folder.
  const file = previousFile ? await ctx.storage.files.update(previousFile, input) : await ctx.storage.files.put(input);
  if (previousFile !== file.id)
    await ctx.storage.records.commit({
      operationId: ctx.storage.ids.create(),
      edits: [{ recordId, replace: { fileId: file.id } }],
    });
};
