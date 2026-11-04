import { normalizeMessageResults, type SessionMessage, sessionSchema, workspaceSchema } from "pstdio-api-contracts";
import { z } from "zod";
import type { RouteDeps } from "../../features/deps";
import { createPersonalIdentity } from "./identity";
import { historyNamespace, type SessionLogFiles } from "./log-files";
import { createPersonalMessageReader } from "./message-reader";
import { sharedQueueRecordSchema, sharedQueueResponse } from "./queue-snapshot";
import { createHistoryReferences, historyReferenceName } from "./references";
import { createPersonalHistoryStore, type HistoryDocuments } from "./store";

const deviceSchema = z.object({ ownerId: z.string(), id: z.string(), name: z.string() });
const personalSessionSchema = sessionSchema.extend({
  device: deviceSchema,
  workspace_id: z.string().nullable(),
});
const personalWorkspaceSchema = workspaceSchema.extend({ device: deviceSchema });
const remoteSession = (
  row: z.infer<typeof personalSessionSchema>,
  login: { accountId: string; deviceId: string },
  projectId: string,
) => row.device.ownerId === login.accountId && row.device.id !== login.deviceId && row.project_id === projectId;

export const createPersonalHistoryService = (input: {
  documents: HistoryDocuments;
  account: Pick<RouteDeps["accountService"], "status"> & Partial<Pick<RouteDeps["accountService"], "watch">>;
  projects: Pick<RouteDeps["projectService"], "list">;
  eventBus: RouteDeps["eventBus"];
  logs: SessionLogFiles;
}) => {
  type MessageListener = (update: { index: number; message: SessionMessage; live: boolean }) => void;
  const messageListeners = new Map<string, Set<MessageListener>>();
  const readerProjects = new Map<string, string>();
  const readerListeners = new Set<() => void>();
  const readersChanged = () => {
    for (const listener of readerListeners) listener();
  };
  const account = createPersonalIdentity({
    account: input.account,
    eventBus: input.eventBus,
    changed: () => {
      messageListeners.clear();
      readerProjects.clear();
      readersChanged();
    },
  });
  const remember = account.remember;
  const context = async (projectId: string) => {
    const login = await account.read();
    if (!login) return null;
    return {
      login,
      identity: account.version,
      namespace: historyNamespace({ ...login, projectId }),
      history: createPersonalHistoryStore({ ...login, projectId, documents: input.documents, files: input.logs }),
    };
  };
  const parsedSessions = new WeakMap<object, z.infer<typeof personalSessionSchema>>();
  const parseSession = (row: Record<string, unknown>) => {
    let value = parsedSessions.get(row);
    if (!value) {
      value = personalSessionSchema.parse(row);
      parsedSessions.set(row, value);
    }
    return value;
  };
  const sessionRecords = async (projectId: string) => {
    const current = await context(projectId);
    if (!current) return [];
    const rows = await current.history.readRecords("sessions");
    await account.read();
    if (current.identity !== account.version) return [];
    return rows.map(parseSession).filter((row) => remoteSession(row, current.login, projectId));
  };
  const sessions = async (projectId: string) =>
    (await sessionRecords(projectId)).map((row) => {
      remember("sessions", row.id, projectId);
      return { ...row, usage_json: row.usage_json ?? null };
    });
  const workspaces = async (projectId: string) => {
    const current = await context(projectId);
    if (!current) return [];
    const rows = await current.history.readRecords("workspaces");
    await account.read();
    if (current.identity !== account.version) return [];
    return rows
      .map((row) => personalWorkspaceSchema.parse(row))
      .filter(
        (row) =>
          row.device.ownerId === current.login.accountId &&
          row.device.id !== current.login.deviceId &&
          row.project_id === projectId &&
          !row.deleted_at,
      )
      .map((row) => {
        remember("workspaces", row.id, projectId);
        return row;
      });
  };
  const links = async (projectId: string) => {
    const current = await context(projectId);
    if (!current) return [];
    const schema = z.object({
      id: z.string(),
      workspace_id: z.string(),
      session_id: z.string(),
      created_at: z.string(),
      device: deviceSchema,
    });
    const rows = await current.history.readRecords("workspace_sessions");
    await account.read();
    if (current.identity !== account.version) return [];
    return rows
      .map((row) => schema.parse(row))
      .filter((row) => row.device.ownerId === current.login.accountId && row.device.id !== current.login.deviceId)
      .map((row) => {
        remember("workspace_sessions", row.id, projectId);
        return row;
      });
  };
  const find = async <T extends { id: string }>(
    read: (projectId: string) => Promise<T[]>,
    id: string,
    projectId?: string,
  ) => {
    const projects = projectId ? [{ id: projectId }] : await input.projects.list();
    for (const project of projects) {
      const row = (await read(project.id)).find((row) => row.id === id);
      if (row) return row;
    }
    return null;
  };
  const getSession = async (id: string, projectId?: string) => {
    const projects = projectId ? [{ id: projectId }] : await input.projects.list();
    for (const project of projects) {
      const current = await context(project.id);
      if (!current) continue;
      const row = await current.history.getRecord("sessions", id);
      await account.read();
      if (!row || current.identity !== account.version) continue;
      const parsed = parseSession(row);
      if (!remoteSession(parsed, current.login, project.id)) continue;
      remember("sessions", id, project.id);
      return { ...parsed, usage_json: parsed.usage_json ?? null };
    }
    return null;
  };
  return {
    logs: input.logs,
    /** Runs for each message another device completed or is streaming in this session. */
    readingSessions(projectId: string) {
      return [...readerProjects].filter(([, project]) => project === projectId).map(([id]) => id);
    },
    watchReaders(listener: () => void) {
      readerListeners.add(listener);
      return () => {
        readerListeners.delete(listener);
      };
    },
    watchMessages(sessionId: string, listener: MessageListener, projectId?: string) {
      const listeners = messageListeners.get(sessionId) ?? new Set();
      listeners.add(listener);
      messageListeners.set(sessionId, listeners);
      if (projectId) readerProjects.set(sessionId, projectId);
      readersChanged();
      return () => {
        listeners.delete(listener);
        if (!listeners.size && messageListeners.get(sessionId) === listeners) {
          messageListeners.delete(sessionId);
          readerProjects.delete(sessionId);
          readersChanged();
        }
      };
    },
    messageReceived(sessionId: string, update: { index: number; message: SessionMessage; live: boolean }) {
      const normalized = { ...update, message: normalizeMessageResults(update.message) };
      for (const listener of messageListeners.get(sessionId) ?? []) listener(normalized);
    },
    refreshIdentity: account.refresh,
    links,
    async visibleRevision(projectId: string) {
      const current = await context(projectId);
      const identity = account.revision;
      const rows = await current?.history.visibleRevision();
      await account.read();
      return { identity, rows };
    },
    async fullState(projectId?: string) {
      await account.read();
      const startedIdentity = account.version;
      const projects = projectId ? [{ id: projectId }] : await input.projects.list();
      const allSessions = (await Promise.all(projects.map((project) => sessions(project.id)))).flat();
      const allWorkspaces = (await Promise.all(projects.map((project) => workspaces(project.id)))).flat();
      const allLinks = (await Promise.all(projects.map((project) => links(project.id)))).flat();
      await account.read();
      if (startedIdentity !== account.version) return { sessions: [], workspaces: [], workspace_sessions: [] };
      return {
        sessions: allSessions,
        workspaces: allWorkspaces,
        workspace_sessions: allLinks,
      };
    },
    reference: (projectId: string, type: string, id: string) =>
      createHistoryReferences(input.documents.open(historyReferenceName), projectId).get(type, id),
    sessions,
    workspaces,
    getSession,
    /** The queued messages of another device's session, read-only. Null when it is not one. */
    async queuedMessages(id: string, projectId?: string) {
      const session = await getSession(id, projectId);
      if (!session?.project_id) return null;
      const current = await context(session.project_id);
      if (!current) return null;
      const record = await current.history.getRecord("queues", id);
      await account.read();
      if (current.identity !== account.version) return null;
      const sameDevice = JSON.stringify(record?.device) === JSON.stringify(session.device);
      const parsed = sharedQueueRecordSchema.safeParse(sameDevice ? record : null);
      return sharedQueueResponse(id, parsed.success ? parsed.data.requests : []);
    },
    getWorkspace: (id: string, projectId?: string) => find(workspaces, id, projectId),
    async getWorkspaceByShorthand(projectId: string, shorthand: string) {
      const matches = (await workspaces(projectId)).filter((row) => row.workspace_shorthand === shorthand);
      return matches.length === 1 ? matches[0]! : null;
    },
    ...createPersonalMessageReader({
      context,
      session: getSession,
      logs: input.logs,
      refreshIdentity: account.read,
      identity: () => account.version,
    }),
  };
};
