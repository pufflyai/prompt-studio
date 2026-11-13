import { hashKey } from "@tanstack/query-core";
import type {
  WebviewCommandQueryEvent,
  WebviewServiceQueryDefinition,
  WebviewServiceQueryRequest,
} from "pstdio-api-contracts/extension-kernel";
import type { GuestHost } from "./guest-host";
import { runQueryCleanup } from "./query-cleanup";
import type { WebviewCommandQuery } from "./webview-command-query";
import { createWebviewQueryProjection } from "./webview-query-projection";

/** Read-only projection of a runtime/account or window-owned service. */
export interface WebviewServiceQuery<T> extends WebviewCommandQuery<T> {}
const roots = new WeakMap<GuestHost, Map<string, ReturnType<typeof createRoot>>>();
const createRoot = (host: GuestHost, service: "account" | "performance" | "preferences") => {
  type Definition = WebviewServiceQueryDefinition;
  const entries = new Map<string, ReturnType<typeof createWebviewQueryProjection<unknown, Definition>>>();
  const seeds = () => host.propsStore?.get().serviceQueries?.[service];
  const identity = () =>
    hashKey([seeds()?.owner, service === "performance" ? null : host.propsStore?.get().queryScope]);
  let authority = identity();
  let closed = false;
  const trim = () => {
    const inactive = [...entries].filter(([, value]) => !value.active());
    for (const [key, value] of inactive.slice(0, Math.max(0, inactive.length - 128))) {
      entries.delete(key);
      value.dispose();
    }
  };
  const clear = () => {
    const values = [...entries.values()];
    entries.clear();
    runQueryCleanup(values.map((value) => value.dispose));
  };
  const stop = host.propsStore?.subscribe(() => {
    const next = identity();
    if (next === authority) {
      for (const entry of entries.values()) {
        const seed = seeds()?.values.find((seed) => hashKey([seed.source]) === hashKey([entry.definition]));
        if (seed) entry.hydrate(seed.snapshot);
      }
      return;
    }
    authority = next;
    clear();
  });
  const request = (query: WebviewServiceQueryRequest) => {
    if (service === "account")
      return host.call("account.read", {
        op: "query",
        query: query as WebviewServiceQueryRequest<import("pstdio-api-contracts/extension-kernel").WebviewAccountQuery>,
      });
    if (service === "preferences")
      return host.call("preferences.get", {
        op: "query",
        query: query as WebviewServiceQueryRequest<
          import("pstdio-api-contracts/extension-kernel").WebviewPreferenceQuery
        >,
      });
    return host.call("performance.read", {
      operation: "query",
      query: query as WebviewServiceQueryRequest<
        import("pstdio-api-contracts/extension-kernel").WebviewPerformanceQuery
      >,
    });
  };

  return {
    query<T>(definition: Definition): WebviewServiceQuery<T> {
      if (closed) throw new Error("Service query authority is closed");
      const owner = seeds()?.owner;
      if (!owner) throw new Error("The host does not support retained service queries");
      const capturedIdentity = identity();
      const key = hashKey([capturedIdentity, definition]);
      let entry = entries.get(key);
      if (!entry || entry.isDisposed()) {
        entry = createWebviewQueryProjection(
          {
            current: () => seeds()?.owner === owner && identity() === capturedIdentity,
            seed: seeds()?.values.find((seed) => hashKey([seed.source]) === hashKey([definition])),
            request: (source, operation, requestId) =>
              request(
                operation === "close"
                  ? { operation, owner, requestId }
                  : { operation, owner, requestId, source: source! },
              ),
            listen: (listener) =>
              host.onEvent(service + ".query", (event) => listener(event as WebviewCommandQueryEvent)),
          },
          structuredClone(definition),
          trim,
        );
        entries.set(key, entry);
      }
      entries.delete(key);
      entries.set(key, entry);
      trim();
      return entry as WebviewServiceQuery<T>;
    },
    dispose() {
      closed = true;
      stop?.();
      clear();
    },
  };
};
export const getWebviewServiceQueries = (host: GuestHost, service: "account" | "performance" | "preferences") => {
  let services = roots.get(host);
  if (!services) {
    services = new Map();
    roots.set(host, services);
  }
  let root = services.get(service);
  if (!root) {
    root = createRoot(host, service);
    services.set(service, root);
  }
  return root;
};
export const disposeWebviewServiceQueries = (host: GuestHost) => {
  const services = roots.get(host);
  roots.delete(host);
  runQueryCleanup([...(services?.values() ?? [])].map((service) => service.dispose));
};
