import {
  defineCommand,
  type ExtensionContextBase,
  type ExtensionSession,
  type ExtensionStorageApi,
  eventRef,
  l10n,
  params,
  type StorageRecordIndex,
} from "@pstdio/sdk/extensions";

export const sessionPinsChanged = eventRef<{ projectId: string }>({
  extensionId: "pstdio.pstdio-session-browser",
  id: "pins.changed",
});

export const sessionPinsIndex: StorageRecordIndex = {
  name: "pinned-sessions",
  fields: { sessionId: { path: ["pinnedSessionId"], type: "string" }, pinned: { path: ["pinned"], type: "boolean" } },
  equality: ["pinned"],
  orderBy: [{ field: "sessionId", direction: "asc" }],
};
const recordValue = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const pinKey = (storage: ExtensionStorageApi, id: string) => storage.records.id(`pin:${id}`);
export const readSessionPins = async (ctx: ExtensionContextBase, sessions: ExtensionSession[]) => {
  const storage = ctx.storage.scope({ type: "project" });
  const records = await storage.records.readMany(sessions.map((session) => pinKey(storage, session.id)));
  const byId = new Map(records.map((record) => [record.recordId, record]));
  return new Map(
    sessions.map((session) => [session.id, recordValue(byId.get(pinKey(storage, session.id))?.value).pinned === true]),
  );
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
    await ctx.events.emit(sessionPinsChanged, { projectId: ctx.projectId });
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
    index: sessionPinsIndex.name,
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
