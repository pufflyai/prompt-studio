import { createScopedQueryClient, type GuestHost, type JsonObject, type PropsStore } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { createWorkbenchWebviewHostCapabilities } from "@pstdio/workbench/extensions";
import { createMarmaladeStore, type ExampleProps, marmaladeCommands, marmaladeContext } from "extension-lab/testing";
import { createHostCapabilityGate } from "pstdio-extensions/bridge/contract";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";

export const marmaladeSessionFixture = (options: { maxInactive?: number } = {}) => {
  const queries = createScopedQueryClient({ runtimeId: "marmalade-fixture", accountId: "authorized" }, options);
  const cores: ReturnType<typeof createWorkbench>[] = [];
  const contexts = new Map<string, ReturnType<typeof marmaladeContext>>();
  const commandReads = new Map<string, number>();
  const stores: { store: ReturnType<typeof createMarmaladeStore>; stop(): void }[] = [];
  const context = (projectId: string) => {
    let fixture = contexts.get(projectId);
    if (fixture) return fixture;
    fixture = marmaladeContext(projectId);
    fixture.observeEvents((hint) => queries.invalidate({ type: "reset", projectId, ...hint }));
    contexts.set(projectId, fixture);
    return fixture;
  };
  const window = (projectId: string) => {
    const core = createWorkbench({ queries });
    core.pageLocations.setProject(projectId);
    cores.push(core);
    for (const [key, command] of Object.entries(marmaladeCommands)) {
      core.commands.registerCommand(
        { id: `pstdio.extension-lab.command.${key}`, label: key },
        {
          execute: async (input) => {
            commandReads.set(key, (commandReads.get(key) ?? 0) + 1);
            const run = command.run as (ctx: ReturnType<typeof context>["ctx"], params: JsonObject) => unknown;
            return run(context(projectId).ctx, (input ?? {}) as JsonObject);
          },
        },
      );
    }
    return {
      core,
      frame: async (beforeCall?: (params: unknown) => Promise<void>) => {
        const events = createHostEventPublisher();
        const listeners = new Map<string, Set<(payload: unknown) => void>>();
        events.bind((event) => {
          for (const listener of listeners.get(event.scope) ?? []) listener(event.payload);
        });
        const gate = createHostCapabilityGate({
          capabilities: createWorkbenchWebviewHostCapabilities({
            workbench: core,
            projectId,
            extensionId: "pstdio.extension-lab",
            hostEvents: events,
          }),
          declaredCapabilities: ["editing.session", "commands.execute"],
        });
        const host: GuestHost = {
          extensionId: "pstdio.extension-lab",
          call: async <T>(method: string, params?: unknown) => {
            await beforeCall?.(params);
            return (await gate.call({ method, params })) as T;
          },
          onEvent(scope, listener) {
            const bucket = listeners.get(scope) ?? new Set();
            listeners.set(scope, bucket);
            bucket.add(listener);
            return () => {
              bucket.delete(listener);
            };
          },
        };
        const store = createMarmaladeStore();
        const ready = Promise.withResolvers<void>();
        const props: PropsStore<ExampleProps> = {
          get: () => ({ projectId, resource: { type: "marmalade.document", id: "great-wave" } }),
          subscribe: () => () => {},
        };
        const stop = store.connect(host, props, ready.reject, (value) => {
          if (value !== false) ready.resolve();
        });
        stores.push({ store, stop });
        await ready.promise;
        return { store, stop };
      },
    };
  };
  return {
    queries,
    context,
    window,
    commandReads,
    fullReads: () => (commandReads.get("marmalade.read") ?? 0) + (commandReads.get("marmalade.session.read") ?? 0),
    async dispose() {
      for (const { stop } of stores) stop();
      await Promise.all(cores.map((core) => core.dispose()));
      queries.dispose();
    },
  };
};
