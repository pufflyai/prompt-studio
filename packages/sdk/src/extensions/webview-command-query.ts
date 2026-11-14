import { hashKey } from "@tanstack/query-core";
import type {
  RendererEventReference,
  WebviewCommandQueryDefinition,
  WebviewCommandQueryEvent,
  WebviewCommandsExecuteParams,
} from "pstdio-api-contracts/extension-kernel";
import { resolveEventReferenceId } from "./event-reference";
import type { GuestHost } from "./guest-host";
import { runQueryCleanup } from "./query-cleanup";
import type { QueryDependency } from "./query-dependency";
import type { ScopedQuerySnapshot } from "./scoped-query";
import { createWebviewQueryProjection } from "./webview-query-projection";

export interface WebviewCommandQueryOptions extends Pick<WebviewCommandsExecuteParams, "workspaceId" | "resource"> {
  events?: readonly RendererEventReference[];
  dependency?: QueryDependency;
}

/** Read-only projection of a host-owned finite source; mutations publish their declared source events. */
export interface WebviewCommandQuery<T> {
  getSnapshot(): ScopedQuerySnapshot<T>;
  subscribe(listener: () => void): () => void;
  isDisposed(): boolean;
  read(signal?: AbortSignal): Promise<T>;
  refresh(signal?: AbortSignal): Promise<T>;
}

export const createWebviewCommandQueries = (host: GuestHost, extensionId: string) => {
  let closed = false;
  const entries = new Map<
    string,
    ReturnType<typeof createWebviewQueryProjection<unknown, WebviewCommandQueryDefinition>>
  >();
  const trim = () => {
    const inactive = [...entries].filter(([, query]) => !query.active());
    for (const [key, query] of inactive.slice(0, Math.max(0, inactive.length - 128))) {
      entries.delete(key);
      query.dispose();
    }
  };
  let authority = host.propsStore?.get().commandQueries?.owner;
  const clear = () => {
    const previous = [...entries.values()];
    entries.clear();
    runQueryCleanup(previous.map((entry) => entry.dispose));
  };
  const stop = host.propsStore?.subscribe(() => {
    const next = host.propsStore?.get().commandQueries?.owner;
    if (next === authority) {
      for (const entry of entries.values()) {
        const seed = host.propsStore
          ?.get()
          .commandQueries?.values.find((seed) => hashKey([seed.command]) === hashKey([entry.definition.command]));
        if (seed) entry.hydrate(seed.snapshot);
      }
      return;
    }
    authority = next;
    clear();
  });
  return {
    query<T>(
      command: WebviewCommandQueryDefinition["command"],
      options: WebviewCommandQueryOptions = {},
      eventOwner = extensionId,
    ) {
      if (closed) throw new Error("Command query authority is closed");
      const owner = host.propsStore?.get().commandQueries?.owner;
      if (!owner) throw new Error("The host does not support retained command queries");
      const resource = command.resource ?? host.propsStore?.get().resource;
      const definition = {
        command: { ...command, ...(resource ? { resource } : {}) },
        dependsOn: options.events?.map((event) => resolveEventReferenceId(event, eventOwner)),
        dependency: options.dependency,
      };
      const key = hashKey([owner, definition]);
      let entry = entries.get(key);
      if (!entry || entry.isDisposed()) {
        entry = createWebviewQueryProjection(
          {
            current: () => host.propsStore?.get().commandQueries?.owner === owner,
            seed: host.propsStore
              ?.get()
              .commandQueries?.values.find((seed) => hashKey([seed.command]) === hashKey([definition.command])),
            request: (definition, operation, requestId) =>
              operation === "close"
                ? host.call("commands.query", { owner, requestId, operation })
                : host.call("commands.query", { ...definition!, owner, requestId, operation }),
            listen: (listener) =>
              host.onEvent("commands.query", (payload) => listener(payload as WebviewCommandQueryEvent)),
          },
          structuredClone(definition),
          trim,
        );
        entries.set(key, entry);
      }
      entries.delete(key);
      entries.set(key, entry);
      trim();
      return entry as WebviewCommandQuery<T>;
    },
    dispose() {
      closed = true;
      stop?.();
      clear();
    },
  };
};
