import { type SessionMessage, sessionSchema, workspaceSchema } from "pstdio-api-contracts";
import { z } from "zod";
import type { RouteDeps } from "../../features/deps";
import { historyNamespace, type SessionLogFiles } from "./log-files";
import { createHistoryReferences, historyReferenceName } from "./references";
import { createPersonalHistoryStore, type HistoryDocuments } from "./store";

const deviceSchema = z.object({ ownerId: z.string(), id: z.string(), name: z.string() });
const personalSessionSchema = sessionSchema.extend({ device: deviceSchema, workspace_id: z.string().nullable() });
const personalWorkspaceSchema = workspaceSchema.extend({ device: deviceSchema });

export const createPersonalHistoryService = (input: {
  documents: HistoryDocuments;
  account: Pick<RouteDeps["accountService"], "status">;
  projects: Pick<RouteDeps["projectService"], "list">;
  eventBus: RouteDeps["eventBus"];
  logs: SessionLogFiles;
}) => {
  type MessageListener = (update: { index: number; message: SessionMessage; live: boolean }) => void;
  const messageListeners = new Map<string, Set<MessageListener>>();
  let identity: string | undefined;
  const visible = new Map<string, { table: string; id: string; projectId: string }>();
  const remember = (table: string, id: string, projectId: string) =>
    visible.set(JSON.stringify([table, id]), { table, id, projectId });
  const refreshIdentity = async () => {
    const { login } = await input.account.status();
    const next = JSON.stringify(login && [login.managerOrigin, login.accountId, login.deviceId]);
    if (identity !== next) {
      for (const { table, id, projectId } of visible.values()) {
        input.eventBus.emit(table, "delete", { id });
        if (table === "workspace_sessions") continue;
        input.eventBus.emit("resource_events", "set", {
          id: crypto.randomUUID(),
          resource: { type: table === "sessions" ? "session" : "workspace", id, projectId, extensionId: "pstdio" },
        });
      }
      visible.clear();
      messageListeners.clear();
      identity = next;
    }
    return login;
  };
  const context = async (projectId: string) => {
    const login = await refreshIdentity();
    if (!login) return null;
    return {
      login,
      identity,
      history: createPersonalHistoryStore({ ...login, projectId, documents: input.documents }),
    };
  };
  const sessions = async (projectId: string) => {
    const current = await context(projectId);
    if (!current) return [];
    const rows = await current.history.readRecords("sessions");
    await refreshIdentity();
    if (current.identity !== identity) return [];
    return rows
      .map((row) => personalSessionSchema.parse(row))
      .filter(
        (row) =>
          row.device.ownerId === current.login.accountId &&
          row.device.id !== current.login.deviceId &&
          row.project_id === projectId,
      )
      .map((row) => {
        remember("sessions", row.id, projectId);
        return { ...row, usage_json: row.usage_json ?? null };
      });
  };
  const workspaces = async (projectId: string) => {
    const current = await context(projectId);
    if (!current) return [];
    const rows = await current.history.readRecords("workspaces");
    await refreshIdentity();
    if (current.identity !== identity) return [];
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
    await refreshIdentity();
    if (current.identity !== identity) return [];
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
  return {
    logs: input.logs,
    /** Runs for each message another device completed or is streaming in this session. */
    watchMessages(sessionId: string, listener: MessageListener) {
      const listeners = messageListeners.get(sessionId) ?? new Set();
      listeners.add(listener);
      messageListeners.set(sessionId, listeners);
      return () => {
        listeners.delete(listener);
        if (!listeners.size && messageListeners.get(sessionId) === listeners) messageListeners.delete(sessionId);
      };
    },
    messageReceived(sessionId: string, update: { index: number; message: SessionMessage; live: boolean }) {
      for (const listener of messageListeners.get(sessionId) ?? []) listener(update);
    },
    refreshIdentity,
    links,
    async fullState(projectId?: string) {
      await refreshIdentity();
      const startedIdentity = identity;
      const projects = projectId ? [{ id: projectId }] : await input.projects.list();
      const allSessions = (await Promise.all(projects.map((project) => sessions(project.id)))).flat();
      const allWorkspaces = (await Promise.all(projects.map((project) => workspaces(project.id)))).flat();
      const allLinks = (await Promise.all(projects.map((project) => links(project.id)))).flat();
      await refreshIdentity();
      if (startedIdentity !== identity) return { sessions: [], workspaces: [], workspace_sessions: [] };
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
    getSession: (id: string, projectId?: string) => find(sessions, id, projectId),
    getWorkspace: (id: string, projectId?: string) => find(workspaces, id, projectId),
    async getWorkspaceByShorthand(projectId: string, shorthand: string) {
      const matches = (await workspaces(projectId)).filter((row) => row.workspace_shorthand === shorthand);
      return matches.length === 1 ? matches[0]! : null;
    },
    async messages(id: string, projectId: string) {
      const current = await context(projectId);
      if (!current || !(await sessions(projectId)).some((row) => row.id === id)) return null;
      const messages = await input.logs.read(historyNamespace({ ...current.login, projectId }), id);
      await refreshIdentity();
      return current.identity === identity ? messages : null;
    },
  };
};
