import type { ChatDraft, ExtensionContextBase, HarnessOperation, StorageRecordIndex } from "@pstdio/sdk/extensions";

export const nativeSubmissionObservationId = (ctx: ExtensionContextBase, id: string) =>
  ctx.storage.records.id(`native-inputs:${id}`);
// Future submissions have new record IDs. One session anchor changes atomically with their history.
const nativeSubmissionChange = (ctx: ExtensionContextBase, id: string, operationId: string) => ({
  recordId: nativeSubmissionObservationId(ctx, id),
  set: { "/operationId": operationId },
});

export const nativeSubmissionIndex: StorageRecordIndex = {
  name: "native-inputs",
  fields: {
    sessionId: { path: ["sessionId"], type: "string" },
    state: { path: ["state"], type: "string" },
    createdAt: { path: ["createdAt"], type: "string" },
  },
  equality: ["sessionId"],
  orderBy: [{ field: "createdAt", direction: "desc" }],
};
interface NativeSubmission {
  sessionId: string;
  fileId: string;
  previousRequest: string | null;
  requestStarted?: string | null;
  started: boolean;
  createdAt: string;
  state: "pending" | "recovering" | "confirmed" | "recovered";
  hidden?: boolean;
}
interface NativeSubmissionBody {
  draft: ChatDraft;
  operation: HarnessOperation;
  message?: string;
}
export const saveNativeSubmission = async (
  ctx: ExtensionContextBase,
  id: string,
  body: NativeSubmissionBody,
  previousRequest: string | null,
  started: boolean,
  requestStarted?: string | null,
) => {
  const file = await ctx.storage.files.put({
    name: "native-input.json",
    mimeType: "application/json",
    data: new TextEncoder().encode(JSON.stringify(body)),
  });
  const submission: NativeSubmission = {
    sessionId: id,
    fileId: file.id,
    previousRequest,
    ...(requestStarted !== undefined && { requestStarted }),
    started,
    createdAt: new Date().toISOString(),
    state: started ? "pending" : "confirmed",
  };
  const recordId = ctx.storage.records.id(`native-input:${ctx.storage.ids.create()}`);
  const operationId = ctx.storage.ids.create();
  await ctx.storage.records.commit({
    operationId,
    edits: [{ recordId, replace: { ...submission } }, nativeSubmissionChange(ctx, id, operationId)],
  });
  return recordId;
};
export const readNativeSubmissions = async (ctx: ExtensionContextBase, id: string, pendingOnly = false) => {
  const page = await ctx.storage.records.query({
    index: nativeSubmissionIndex.name,
    where: {
      all: [
        { field: "sessionId", op: "eq", value: id },
        ...(pendingOnly
          ? [
              {
                any: [
                  { field: "state", op: "eq" as const, value: "pending" },
                  { field: "state", op: "eq" as const, value: "recovering" },
                ],
              },
            ]
          : []),
      ],
    },
    limit: pendingOnly ? 100 : 1,
  });
  const records = await ctx.storage.records.readMany(page.records.map((row) => row.recordId));
  return Promise.all(
    records
      .filter((record) => record.exists && !record.deleted)
      .map(async (record) => {
        const value = record.value as unknown as NativeSubmission;
        if (!value || typeof value.fileId !== "string" || value.sessionId !== id)
          throw new Error("The saved native input needs recovery. Its record has been kept.");
        const body = JSON.parse(
          new TextDecoder().decode(await ctx.storage.files.getBytes(value.fileId)),
        ) as NativeSubmissionBody;
        return { recordId: record.recordId, value, body };
      }),
  );
};
export const updateNativeSubmission = async (
  ctx: ExtensionContextBase,
  recordId: string,
  update: Partial<Pick<NativeSubmission, "state" | "hidden" | "requestStarted">>,
  sessionId?: string,
) => {
  const record = await ctx.storage.records.read(recordId);
  if (!record.exists || record.deleted) return;
  const value = { ...(record.value as unknown as NativeSubmission), ...update };
  if (sessionId && value.sessionId !== sessionId)
    throw new Error("This submitted input does not belong to this conversation.");
  const operationId = ctx.storage.ids.create();
  const changed = nativeSubmissionChange(ctx, value.sessionId, operationId);
  if (value.hidden && (value.state === "confirmed" || value.state === "recovered")) {
    await ctx.storage.records.commit({ operationId, edits: [{ recordId, deleted: true }, changed] });
    await ctx.storage.files.delete(value.fileId);
    return;
  }
  await ctx.storage.records.commit({
    operationId,
    edits: [{ recordId, replace: { ...value } }, changed],
  });
};
