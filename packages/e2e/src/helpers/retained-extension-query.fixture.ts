import type { ScopedQuery } from "@pstdio/sdk/extensions";
import { createScopedQueryClient, type GuestHost } from "@pstdio/sdk/extensions";
import {
  createExtensionWebviewHostCapabilities,
  createWebviewCommandQueryAdapter,
  createWebviewServiceQueryAdapter,
} from "@pstdio/workbench/extensions";
import type {
  WebviewAccountQuery,
  WebviewCommandQueryDefinition,
  WebviewHostCapability,
  WebviewHostProps,
} from "pstdio-api-contracts/extension-kernel";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";

/** Exercise consumers through the real host owner, with independent disposable guest frames. */
export const createRetainedExtensionQueryFixture = (input: {
  extensionId: string;
  adapters?(
    events: ReturnType<typeof createHostEventPublisher>,
    projectId: string,
  ): import("@pstdio/workbench/extensions").ExtensionWebviewHostAdapters;
  account?: {
    source(definition: WebviewAccountQuery): ScopedQuery<unknown>;
    sources(projectId: string): readonly { source: WebviewAccountQuery; query: ScopedQuery<unknown> }[];
    requireCurrent?(accountId?: string, origin?: string): void;
  };
  call?(method: string, input: unknown): Promise<unknown>;
  delayReply?(method: string, input: unknown, value: unknown): Promise<unknown>;
  execute(command: WebviewCommandQueryDefinition["command"], signal: AbortSignal, projectId: string): Promise<unknown>;
}) => {
  const queries = createScopedQueryClient({ runtimeId: "retained-contract", extensionId: "pstdio" });
  const frames = new Set<ReturnType<typeof frame>>();
  const frame = (initialProjectId = "selected") => {
    let projectId = initialProjectId;
    const events = createHostEventPublisher();
    const listeners = new Map<string, Set<(payload: unknown) => void>>();
    let closed = false;
    const propsListeners = new Set<(props: WebviewHostProps) => void>();
    let accountId: string | undefined;
    let accountOrigin: string | undefined;
    const createAdapter = () => {
      const capturedProject = projectId;
      return createWebviewCommandQueryAdapter({
        queries,
        projectId,
        extensionId: input.extensionId,
        owner: JSON.stringify([projectId, input.extensionId, accountId, accountOrigin]),
        events,
        requireCurrent() {
          if (closed || capturedProject !== projectId) throw new Error("Frame closed");
        },
        captureRead: (command) => (signal) => input.execute(command, signal, capturedProject),
      });
    };
    let adapter = createAdapter();
    const createServices = () => {
      const capturedAccount = accountId,
        capturedOrigin = accountOrigin;
      return input.account
        ? createWebviewServiceQueryAdapter({
            channel: "account.query",
            owner: JSON.stringify(["account", accountId, accountOrigin]),
            events,
            requireCurrent() {
              if (closed) throw new Error("Frame closed");
              input.account?.requireCurrent?.(capturedAccount, capturedOrigin);
            },
            sources: () => input.account!.sources(projectId),
            source: (definition) => input.account!.source(definition),
          })
        : undefined;
    };
    let services = createServices();
    let extra = input.adapters?.(events, projectId);
    let capabilities = createExtensionWebviewHostCapabilities({
      ...extra,
      commandQueries: adapter,
      accountQueries: services,
    });
    const props = {
      projectId,
      queryScope: { runtimeId: "retained-contract" },
      commandQueries: adapter.seeds(),
      serviceQueries: { account: services?.seeds(), preferences: extra?.preferenceQueries?.seeds() },
    } as WebviewHostProps;
    const host = {
      extensionId: input.extensionId,
      propsStore: {
        get: () => props,
        subscribe: (listener: (props: WebviewHostProps) => void) => {
          propsListeners.add(listener);
          return () => {
            propsListeners.delete(listener);
          };
        },
      },
      onEvent(scope: string, listener: (payload: unknown) => void) {
        const group = listeners.get(scope) ?? new Set();
        listeners.set(scope, group);
        group.add(listener);
        return () => {
          group.delete(listener);
        };
      },
      async call(method: string, command: WebviewCommandQueryDefinition["command"]) {
        if (input.call && !["commands.execute", "commands.query", "account.read"].includes(method))
          return input.call(method, command);
        if (method === "commands.execute")
          return {
            outcome: {
              ok: true,
              status: "success",
              value: await input.execute(command, new AbortController().signal, projectId),
            },
          };
        const value = await capabilities[method as WebviewHostCapability](command as never);
        return input.delayReply ? input.delayReply(method, command, value) : value;
      },
    } as unknown as GuestHost;
    events.bind((event) => {
      for (const listener of [...(listeners.get(event.scope) ?? [])]) listener(event.payload);
    });
    const result = {
      host,
      props,
      listeners,
      project(next: string) {
        projectId = next;
        props.projectId = next;
        adapter = createAdapter();
        services = createServices();
        extra = input.adapters?.(events, projectId);
        capabilities = createExtensionWebviewHostCapabilities({
          ...extra,
          commandQueries: adapter,
          accountQueries: services,
        });
        props.commandQueries = adapter.seeds();
        props.serviceQueries = { account: services?.seeds(), preferences: extra?.preferenceQueries?.seeds() };
        for (const listener of [...propsListeners]) listener(props);
      },
      authority(nextAccount: string, nextOrigin: string) {
        accountId = nextAccount;
        accountOrigin = nextOrigin;
        queries.setAuthority({ accountId, accountOrigin });
        props.queryScope = { runtimeId: "retained-contract", accountId, accountOrigin };
        adapter = createAdapter();
        services = createServices();
        extra = input.adapters?.(events, projectId);
        capabilities = createExtensionWebviewHostCapabilities({
          ...extra,
          commandQueries: adapter,
          accountQueries: services,
        });
        props.commandQueries = adapter.seeds();
        props.serviceQueries = { account: services?.seeds(), preferences: extra?.preferenceQueries?.seeds() };
        for (const listener of [...propsListeners]) listener(props);
      },
      dispose() {
        closed = true;
        events.unbind();
        listeners.clear();
        frames.delete(result);
      },
    };
    frames.add(result);
    return result;
  };
  return {
    queries,
    frame,
    emit(id: string, projectId = "selected", resourceIds?: string[]) {
      queries.invalidate({ type: "changed", id, projectId, ...(resourceIds ? { resourceIds } : {}) });
    },
    dispose() {
      for (const entry of [...frames]) entry.dispose();
      queries.dispose();
    },
  };
};
