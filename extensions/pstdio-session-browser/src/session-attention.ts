import {
  type CommandContext,
  defineCommand,
  type ExtensionContextBase,
  type ExtensionSession,
  type ExtensionStorageApi,
  l10n,
  params,
  type StorageRecordIndex,
  viewDataEvents,
} from "@pstdio/sdk/extensions";

export const sessionAttentionIndex: StorageRecordIndex = {
  name: "pinned-sessions",
  fields: { sessionId: { path: ["pinnedSessionId"], type: "string" }, pinned: { path: ["pinned"], type: "boolean" } },
  equality: ["pinned"],
  orderBy: [{ field: "sessionId", direction: "asc" }],
};
export const sessionActivity = (session: ExtensionSession) =>
  Math.max(
    0,
    ...[session.createdAt, session.updatedAt, session.lastRequestStarted, session.lastRequestEnded]
      .filter((value): value is string => typeof value === "string")
      .map((value) => Date.parse(value))
      .filter(Number.isFinite),
  );
const recordValue = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const pinKey = (storage: ExtensionStorageApi, id: string) => storage.records.id(`pin:${id}`);
const seenKey = (storage: ExtensionStorageApi, id: string) => storage.records.id(`seen:${id}`);

export const readSessionAttention = async (ctx: ExtensionContextBase, sessions: ExtensionSession[]) => {
  const storage = ctx.storage.scope({ type: "project" });
  const records = await storage.records.readMany(
    sessions.flatMap((session) => [pinKey(storage, session.id), seenKey(storage, session.id)]),
  );
  const byId = new Map(records.map((record) => [record.recordId, record]));
  return new Map(
    sessions.map((session) => {
      const pinned = recordValue(byId.get(pinKey(storage, session.id))?.value).pinned === true;
      const seen = recordValue(byId.get(seenKey(storage, session.id))?.value).activity;
      return [session.id, { pinned, unread: typeof seen === "number" && seen < sessionActivity(session) }];
    }),
  );
};
export const markSessionSeen = async (ctx: CommandContext, session: ExtensionSession) => {
  const storage = ctx.storage.scope({ type: "project" });
  if (ctx.signal.aborted) return;
  const recordId = seenKey(storage, session.id);
  const previous = await storage.records.read(recordId);
  const activity = sessionActivity(session);
  if (
    typeof recordValue(previous.value).activity === "number" &&
    Number(recordValue(previous.value).activity) >= activity
  )
    return;
  await storage.records.commit({
    operationId: storage.ids.create(),
    edits: [{ recordId, replace: { activity } }],
  });
  await ctx.events.emit(viewDataEvents.sessionsChanged, { projectId: ctx.projectId });
};
export const pinSession = defineCommand({
  id: "pin",
  title: l10n("commands.pin", "Pin session"),
  cli: true,
  params: {
    sessionId: params.text({ required: true, resolvedFrom: "resource" }),
    pinned: params.boolean({ required: true }),
  },
  async run(ctx, input) {
    const storage = ctx.storage.scope({ type: "project" });
    const session = await ctx.sessions.get(input.sessionId);
    if (!session || session.archived) throw new Error("Session not found.");
    await storage.records.commit({
      operationId: storage.ids.create(),
      edits: [
        {
          recordId: pinKey(storage, session.id),
          replace: { pinnedSessionId: session.id, pinned: input.pinned },
        },
      ],
    });
    await ctx.events.emit(viewDataEvents.sessionsChanged, { projectId: ctx.projectId });
  },
});
export const readPinnedSessions = async (
  ctx: ExtensionContextBase,
  workspaceId?: string,
  filter?: string,
  cursor?: string,
) => {
  const storage = ctx.storage.scope({ type: "project" });
  const page = await storage.records.query({
    index: sessionAttentionIndex.name,
    where: { field: "pinned", op: "eq", value: true },
    limit: 50,
    ...(cursor ? { cursor } : {}),
  });
  const records = await storage.records.readMany(page.records.map((record) => record.recordId));
  const sessions = await Promise.all(
    records.map((record) =>
      typeof recordValue(record.value).pinnedSessionId === "string"
        ? ctx.sessions.get(String(recordValue(record.value).pinnedSessionId))
        : undefined,
    ),
  );
  return {
    items: sessions
      .filter((session) => session != null)
      .filter(
        (session) =>
          !session.archived &&
          (!workspaceId || session.workspaceId === workspaceId) &&
          (!filter || session.title.toLocaleLowerCase().includes(filter.toLocaleLowerCase())),
      ),
    nextCursor: page.cursor ?? undefined,
  };
};
