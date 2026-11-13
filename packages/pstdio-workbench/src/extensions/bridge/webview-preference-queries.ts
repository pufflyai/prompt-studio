import type { ScopedQuery } from "@pstdio/sdk/extensions";
import type { WebviewPreferenceQuery, WebviewPreferenceQueryValue } from "pstdio-api-contracts/extension-kernel";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import type { PreferenceScopeRef, PreferenceValue, WorkbenchCore } from "../../core";
import { getWorkbenchQueries } from "../../core/workbench-queries";
import { isWorkbenchRetiring } from "../../core/workbench-required-work";
import { getWebviewCommandQueryContext } from "./webview-command-query-context";
import type { WebviewOwnedPreferences } from "./webview-preferences-capability";
import { createWebviewServiceQueryAdapter } from "./webview-service-queries";

interface Entry {
  owner: string;
  extensionId: string;
  definition: WebviewPreferenceQuery;
  query: ScopedQuery<WebviewPreferenceQueryValue>;
  version: number;
  pending?: Promise<void>;
}
const roots = new WeakMap<WorkbenchCore, ReturnType<typeof createRoot>>();
const waitForWrite = (pending: Promise<void>, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(signal.reason);
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    void pending.then(
      () => {
        signal.removeEventListener("abort", abort);
        resolve();
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
const createRoot = (core: WorkbenchCore) => {
  const entries = new Map<string, Entry>();
  const queries = getWorkbenchQueries(core);
  const context = getWebviewCommandQueryContext(core);
  const prune = () => {
    for (const [key, entry] of entries) if (entry.query.isDisposed()) entries.delete(key);
  };
  const stopRetirement = queries.subscribeRetirement(prune);
  const stopRegistry = core.preferences.onDidChangeValue((name) => {
    for (const entry of entries.values())
      if (name === entry.definition.name || name === JSON.stringify([entry.extensionId, entry.definition.name]))
        entry.query.invalidate();
  });
  context.subscribeClose(() => {
    stopRegistry.dispose();
    stopRetirement();
    for (const entry of entries.values()) entry.query.dispose();
    entries.clear();
  });
  return {
    entries,
    source(input: {
      owner: string;
      extensionId: string;
      projectId?: string;
      definition: WebviewPreferenceQuery;
      get: WebviewOwnedPreferences["get"];
    }) {
      const definition = { ...input.definition, scope: input.definition.scope ?? { scope: "user" as const } };
      const key = JSON.stringify([
        input.owner,
        definition.name,
        definition.scope.scope,
        definition.scope.scopeId ?? null,
      ]);
      const entry = entries.get(key);
      if (entry && !entry.query.isDisposed()) return entry;
      const next: Entry = {
        owner: input.owner,
        extensionId: input.extensionId,
        definition,
        version: 0,
        query: queries.forScope({ projectId: input.projectId, extensionId: input.extensionId }).query({
          id: "webview.preference",
          params: { owner: input.owner, definition },
          dependsOn: ["preferences.changed"],
          dependency: {
            resourceId: definition.name,
            projectId: definition.scope.scope === "project" ? (definition.scope.scopeId ?? input.projectId) : undefined,
          },
          async read(signal) {
            for (;;) {
              const pending = next.pending;
              if (!pending) break;
              await waitForWrite(pending, signal);
            }
            signal.throwIfAborted();
            const value = await input.get(definition.name, definition.scope);
            signal.throwIfAborted();
            return { value };
          },
        }),
      };
      entries.set(key, next);
      const inactive = [...entries].filter(([, entry]) => !entry.query.active());
      for (const [key, entry] of inactive.slice(0, Math.max(0, inactive.length - 128))) {
        if (entry === next) continue;
        entries.delete(key);
        entry.query.dispose();
      }
      return next;
    },
  };
};

/** Accepted choices and required persistence survive guest recreation; canonical reads stay optional. */
export const createWebviewPreferenceQueries = (input: {
  workbench: WorkbenchCore;
  extensionId: string;
  projectId?: string;
  events: HostEventPublisher;
  identity?: readonly unknown[];
  authority?: { id: string; assertCurrent(): void };
  preferences: WebviewOwnedPreferences;
}) => {
  const core = input.workbench,
    context = getWebviewCommandQueryContext(core);
  let root = roots.get(core);
  if (!root) {
    root = createRoot(core);
    roots.set(core, root);
  }
  const owner = JSON.stringify([context.id, input.extensionId, input.projectId, input.identity, input.authority?.id]);
  const source = (definition: WebviewPreferenceQuery) =>
    root.source({
      owner,
      definition,
      projectId: input.projectId,
      extensionId: input.extensionId,
      get: input.preferences.get,
    });
  const adapter = createWebviewServiceQueryAdapter({
    channel: "preferences.query",
    owner,
    events: input.events,
    workbench: core,
    projectId: input.projectId,
    requireCurrent() {
      input.authority?.assertCurrent();
    },
    source: (definition) => source(definition).query,
    sources: () =>
      [...root.entries.values()]
        .filter((entry) => entry.owner === owner && !entry.query.isDisposed())
        .map((entry) => ({ source: entry.definition, query: entry.query })),
  });
  return {
    ...adapter,
    set(name: string, value: PreferenceValue, scope: PreferenceScopeRef) {
      if (isWorkbenchRetiring(core)) throw new Error("Workbench is closed");
      context.assertCurrent(input.projectId);
      input.authority?.assertCurrent();
      if (scope.scope === "default") throw new Error("preference_scope_read_only");
      if (scope.scope === "repo") throw new Error("Repository preferences are unavailable in extension webviews");
      const entry = source({ service: "preference", name, scope: { scope: scope.scope, scopeId: scope.scopeId } });
      const version = ++entry.version;
      const completion = Promise.withResolvers<void>();
      void completion.promise.catch(() => {});
      entry.pending = completion.promise;
      const release = entry.query.subscribe(() => {}, { automatic: false });
      entry.query.accept({ value: structuredClone(value) });
      const finish = () => {
        if (entry.pending === completion.promise) entry.pending = undefined;
        release();
      };
      try {
        const write = input.preferences.set(name, value, scope);
        void Promise.resolve(write).then(
          () => {
            finish();
            completion.resolve();
          },
          (error) => {
            if (!entry.query.isDisposed() && entry.version === version) entry.query.reportError(error);
            finish();
            completion.reject(error);
          },
        );
      } catch (error) {
        if (!entry.query.isDisposed() && entry.version === version) entry.query.reportError(error);
        finish();
        completion.reject(error);
      }
      return completion.promise;
    },
  };
};
