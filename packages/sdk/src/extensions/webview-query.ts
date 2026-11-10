import {
  type CommandRef,
  EXTENSION_EVENTS_SCOPE,
  type JsonObject,
  type RendererEventReference,
  type Struct,
} from "pstdio-api-contracts/extension-kernel";
import { commandRefId } from "./contribution-reference";
import { resolveEventReferenceId } from "./event-reference";
import type { GuestHost } from "./guest-host";
import { runQueryCleanup } from "./query-cleanup";
import { createScopedQueryClient, type QueryScope, type ScopedQueryDescriptor } from "./scoped-query";
import { createWebviewCommandQueries, type WebviewCommandQueryOptions } from "./webview-command-query";
import type { WebviewExtensionEvent } from "./webview-events";

export type WebviewQueryDescriptor<T> = ScopedQueryDescriptor<T> & {
  events?: readonly RendererEventReference[];
  scope?: Partial<QueryScope>;
};

const createRoot = (host: GuestHost) => {
  const commands = createWebviewCommandQueries(host, host.extensionId ?? "");
  const root = createScopedQueryClient(
    { runtimeId: "webview", extensionId: host.extensionId ?? "" },
    {
      subscribe: (invalidate) =>
        host.onEvent(EXTENSION_EVENTS_SCOPE, (payload) => invalidate(payload as WebviewExtensionEvent)),
    },
  );
  let boundary = host.propsStore?.get().queryScope;
  const stopProps = host.propsStore?.subscribe(() => {
    const next = host.propsStore?.get().queryScope;
    if (
      boundary?.runtimeId !== next?.runtimeId ||
      boundary?.accountId !== next?.accountId ||
      boundary?.accountOrigin !== next?.accountOrigin
    ) {
      root.clearScope({});
      boundary = next;
    }
  });
  return { root, stopProps, commands };
};
const roots = new WeakMap<GuestHost, ReturnType<typeof createRoot>>();

/** Project activation reuses cache; account/runtime changes revoke the previous cache authority. */
export const createWebviewQueryClient = (host: GuestHost, extensionId = host.extensionId ?? "") => {
  let state = roots.get(host);
  if (!state) {
    state = createRoot(host);
    roots.set(host, state);
  }
  const { root, stopProps, commands } = state;
  return {
    /** Host-owned finite command data survives destruction of this iframe. */
    command<Params extends Struct, Result>(
      command: CommandRef<Params, Result>,
      params?: Params,
      options?: WebviewCommandQueryOptions,
    ) {
      const commandId = commandRefId(command, extensionId);
      return commands.query<Result>(
        {
          commandId,
          params: params as JsonObject | undefined,
          workspaceId: options?.workspaceId,
          resource: options?.resource,
        },
        options,
        extensionId,
      );
    },
    /** Selected authority/project identity; unrelated host props leave this snapshot equal. */
    getScope() {
      const props = host.propsStore?.get();
      return JSON.stringify([
        props?.projectId,
        props?.queryScope?.runtimeId,
        props?.queryScope?.accountId,
        props?.queryScope?.accountOrigin,
      ]);
    },
    subscribeScope(listener: () => void) {
      return host.propsStore?.subscribe(listener) ?? (() => {});
    },
    query<T>(input: WebviewQueryDescriptor<T>) {
      const props = host.propsStore?.get();
      return root
        .forScope({
          runtimeId: "webview",
          ...props?.queryScope,
          extensionId,
          projectId: props?.projectId,
          ...input.scope,
        })
        .query({
          ...input,
          dependsOn: input.events?.map((event) => resolveEventReferenceId(event, extensionId)) ?? input.dependsOn,
        });
    },
    inspect: root.inspect,
    dispose() {
      if (roots.get(host) !== state) return;
      roots.delete(host);
      runQueryCleanup([() => stopProps?.(), commands.dispose, root.dispose]);
    },
  };
};
