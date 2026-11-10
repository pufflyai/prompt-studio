import { EXTENSION_EVENTS_SCOPE, type RendererEventReference } from "pstdio-api-contracts/extension-kernel";
import { resolveEventReferenceId } from "./event-reference";
import type { GuestHost } from "./guest-host";
import { createScopedQueryClient, type QueryScope, type ScopedQueryDescriptor } from "./scoped-query";
import type { WebviewExtensionEvent } from "./webview-events";

export type WebviewQueryDescriptor<T> = ScopedQueryDescriptor<T> & {
  events?: readonly RendererEventReference[];
  scope?: Partial<QueryScope>;
};

const createRoot = (host: GuestHost) => {
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
  return { root, stopProps };
};
const roots = new WeakMap<GuestHost, ReturnType<typeof createRoot>>();

/** Project activation reuses cache; account/runtime changes revoke the previous cache authority. */
export const createWebviewQueryClient = (host: GuestHost, extensionId = host.extensionId ?? "") => {
  let state = roots.get(host);
  if (!state) {
    state = createRoot(host);
    roots.set(host, state);
  }
  const { root, stopProps } = state;
  return {
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
      stopProps?.();
      root.dispose();
      roots.delete(host);
    },
  };
};
