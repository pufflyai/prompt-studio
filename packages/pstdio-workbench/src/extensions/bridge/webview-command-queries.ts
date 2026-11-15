import type { ScopedQueryClient } from "@pstdio/sdk/extensions";
import type { WebviewCommandQueryDefinition, WebviewCommandQueryRequest } from "pstdio-api-contracts/extension-kernel";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import type { WorkbenchCore } from "../../core";
import { getWebviewCommandQueryContext } from "./webview-command-query-context";
import { getWebviewCommandQuerySources } from "./webview-command-query-source";
import { serveWebviewQuery } from "./webview-query-members";

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
      return serveWebviewQuery({
        channel: "commands.query",
        owner,
        events,
        request,
        requireCurrent() {
          context?.assertCurrent(projectId);
          input.requireCurrent();
        },
        subscribeClose: (close) => subscribeCore(context, close),
        source() {
          if (request.operation === "close") throw new Error("Retained query is closed");
          const definition = structuredClone({
            command: request.command,
            dependsOn: request.dependsOn,
            dependency: request.dependency,
          });
          const command = definition.command;
          return root.source({
            owner,
            projectId,
            extensionId,
            definition,
            context: sourceContext(command.commandId, context),
            read: captureRead(context, projectId, command.commandId, input.captureRead(command)),
          });
        },
      });
    },
  };
};
