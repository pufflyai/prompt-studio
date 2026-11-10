import type { ScopedQueryClient } from "@pstdio/sdk/extensions";
import type {
  WebviewCommandQueryDefinition,
  WebviewCommandQueryRequest,
  WebviewCommandQuerySnapshot,
} from "pstdio-api-contracts/extension-kernel";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import type { WorkbenchCore } from "../../core";
import { getWebviewCommandQueryContext } from "./webview-command-query-context";
import { getWebviewCommandQuerySources } from "./webview-command-query-source";
import { runQueryCallbacks } from "./webview-query-cleanup";

interface Member {
  owner: string;
  close(): void;
}
const closeRequest = (members: Map<string, Member>, request: { owner: string; requestId: string }) => {
  const member = members.get(request.requestId);
  if (member?.owner === request.owner) member.close();
};
const captureRead = (
  context: ReturnType<typeof getWebviewCommandQueryContext> | undefined,
  projectId: string,
  commandId: string,
  read: (signal: AbortSignal) => Promise<unknown>,
) => {
  if (!context || commandId.includes(".command.")) return read;
  return async (signal: AbortSignal) => {
    context.assertCurrent(projectId);
    signal.throwIfAborted();
    const value = await read(signal);
    signal.throwIfAborted();
    context.assertCurrent(projectId);
    return value;
  };
};
const sourceContext = (commandId: string, context?: ReturnType<typeof getWebviewCommandQueryContext>) =>
  commandId.includes(".command.") ? undefined : context?.id;
const subscribeCore = (context: ReturnType<typeof getWebviewCommandQueryContext> | undefined, close: () => void) =>
  context?.subscribeClose(close) ?? (() => {});
const requireAdmission = (
  context: ReturnType<typeof getWebviewCommandQueryContext> | undefined,
  projectId: string,
  requireCurrent: () => void,
  isClosed: () => boolean,
) => {
  if (isClosed()) throw new Error("Command query request is closed");
  context?.assertCurrent(projectId);
  requireCurrent();
  if (isClosed()) throw new Error("Command query request is closed");
};
const isSettled = (snapshot: WebviewCommandQuerySnapshot) =>
  snapshot.retired || (!snapshot.fetching && !snapshot.stale && (snapshot.data !== undefined || snapshot.error));
const createPublication =
  (input: {
    current(): boolean;
    snapshot(): WebviewCommandQuerySnapshot;
    observing: boolean;
    requestId: string;
    events: HostEventPublisher;
    close(): void;
    resolve(value: WebviewCommandQuerySnapshot): void;
  }) =>
  () => {
    if (!input.current()) return;
    const snapshot = input.snapshot();
    if (input.observing) {
      try {
        input.events.emit({ scope: "commands.query", payload: { requestId: input.requestId, snapshot } });
      } finally {
        if (snapshot.retired) input.close();
      }
    } else if (isSettled(snapshot)) input.resolve(snapshot);
  };
const connections = new WeakMap<HostEventPublisher, Map<string, Member>>();
const connection = (events: HostEventPublisher) => {
  let members = connections.get(events);
  if (members) return members;
  members = new Map();
  connections.set(events, members);
  const owned = members;
  events.onDisconnect(() => {
    runQueryCallbacks([...owned.values()].map((member) => member.close));
  });
  return members;
};

/** The executor must belong to runtime/project authority, never to an iframe mutation or placement callback. */
export const createWebviewCommandQueryAdapter = (input: {
  queries: ScopedQueryClient;
  owner: string;
  projectId: string;
  extensionId: string;
  events: HostEventPublisher;
  workbench?: WorkbenchCore;
  requireCurrent(): void;
  captureRead(command: WebviewCommandQueryDefinition["command"]): (signal: AbortSignal) => Promise<unknown>;
}) => {
  const root = getWebviewCommandQuerySources(input.queries);
  const { owner, projectId, extensionId, events } = input;
  const context = input.workbench ? getWebviewCommandQueryContext(input.workbench) : undefined;
  if (context) root.bindContext(context);
  return {
    seeds: () => ({ owner, values: root.seeds(owner, context?.id) }),
    async request(request: WebviewCommandQueryRequest) {
      const members = connection(events);
      if (request.operation === "close") {
        closeRequest(members, request);
        return;
      }
      if (request.owner !== owner) throw new Error("Command query authority is closed");
      context?.assertCurrent(projectId);
      input.requireCurrent();
      if (members.has(request.requestId)) throw new Error("Command query request already exists");
      const definition = structuredClone({
        command: request.command,
        dependsOn: request.dependsOn,
        dependency: request.dependency,
      });
      const command = definition.command;
      const source = root.source({
        owner,
        projectId,
        extensionId,
        definition,
        context: sourceContext(command.commandId, context),
        read: captureRead(context, projectId, command.commandId, input.captureRead(command)),
      });
      let closed = false;
      let stop = () => {};
      let stopCore = () => {};
      const settled = Promise.withResolvers<WebviewCommandQuerySnapshot>();
      // Retirement can close a member before the finite path starts awaiting it.
      void settled.promise.catch(() => {});
      const member: Member = {
        owner,
        close() {
          if (closed) return;
          closed = true;
          if (members.get(request.requestId) === member) members.delete(request.requestId);
          runQueryCallbacks([stop, stopCore, () => settled.reject(new Error("Command query request is closed"))]);
        },
      };
      members.set(request.requestId, member);
      stopCore = subscribeCore(context, member.close);
      const changed = createPublication({
        current: () => !closed,
        snapshot: source.snapshot,
        observing: request.operation === "observe",
        requestId: request.requestId,
        events,
        close: member.close,
        resolve: settled.resolve,
      });
      try {
        if (request.operation === "refresh") source.query.invalidate();
        requireAdmission(context, projectId, input.requireCurrent, () => closed);
        stop = source.observe(changed);
        if (closed) stop();
        else changed();
        if (request.operation === "observe") {
          if (closed) throw new Error("Command query request is closed");
          return source.snapshot();
        }
        return await settled.promise;
      } catch (error) {
        member.close();
        throw error;
      } finally {
        if (request.operation !== "observe") member.close();
      }
    },
  };
};
