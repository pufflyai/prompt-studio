import type { ScopedQuery, ScopedQueryClient } from "@pstdio/sdk/extensions";
import type {
  WebviewCommandQueryDefinition,
  WebviewCommandQuerySeed,
  WebviewCommandQuerySnapshot,
} from "pstdio-api-contracts/extension-kernel";
import type { getWebviewCommandQueryContext } from "./webview-command-query-context";
import { runQueryCallbacks } from "./webview-query-cleanup";
import { getWebviewQuerySource } from "./webview-query-source";

interface Source {
  owner: string;
  command: WebviewCommandQueryDefinition["command"];
  context?: string;
  query: ScopedQuery<unknown>;
  snapshot(): WebviewCommandQuerySnapshot;
  observe(listener: () => void): () => void;
}

const roots = new WeakMap<ScopedQueryClient, ReturnType<typeof createRoot>>();
const createRoot = (queries: ScopedQueryClient) => {
  const entries = new Map<ScopedQuery<unknown>, Source>();
  const owners = new Map<string, Set<Source>>();
  const contexts = new WeakSet<ReturnType<typeof getWebviewCommandQueryContext>>();
  const retire = () => {
    for (const [query, source] of entries) {
      if (!query.isDisposed()) continue;
      entries.delete(query);
      owners.get(source.owner)?.delete(source);
      if (!owners.get(source.owner)?.size) owners.delete(source.owner);
    }
  };
  queries.subscribeRetirement(retire);
  return {
    bindContext(context: ReturnType<typeof getWebviewCommandQueryContext>) {
      if (contexts.has(context)) return;
      contexts.add(context);
      context.subscribeClose(() =>
        runQueryCallbacks(
          [...entries.values()].filter((source) => source.context === context.id).map((source) => source.query.dispose),
        ),
      );
    },
    seeds(owner: string, context?: string) {
      return [...(owners.get(owner) ?? [])]
        .filter((source) => source.context === (source.command.commandId.includes(".command.") ? undefined : context))
        .map(
          (source) =>
            ({
              command: source.command,
              snapshot: source.snapshot(),
            }) satisfies WebviewCommandQuerySeed,
        );
    },
    source(input: {
      owner: string;
      projectId: string;
      extensionId: string;
      definition: WebviewCommandQueryDefinition;
      context?: string;
      read(signal: AbortSignal): Promise<unknown>;
    }) {
      const { definition, owner, projectId, extensionId } = input;
      const query = queries.forScope({ projectId, extensionId }).query({
        id: "webview.command",
        params: { owner, command: definition.command, context: input.context },
        dependsOn: definition.dependsOn,
        dependency: { ...definition.dependency, projectId, extensionId: definition.dependency?.extensionId },
        read: input.read,
      });
      let source = entries.get(query);
      if (source) return source;
      source = {
        owner,
        command: structuredClone(definition.command),
        context: input.context,
        ...getWebviewQuerySource(query),
      };
      entries.set(query, source);
      let owned = owners.get(owner);
      if (!owned) {
        owned = new Set();
        owners.set(owner, owned);
      }
      owned.add(source);
      return source;
    },
  };
};

export const getWebviewCommandQuerySources = (queries: ScopedQueryClient) => {
  let root = roots.get(queries);
  if (!root) {
    root = createRoot(queries);
    roots.set(queries, root);
  }
  return root;
};
