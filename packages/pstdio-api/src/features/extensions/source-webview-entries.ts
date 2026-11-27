import type { PackageAssetDescriptor } from "pstdio-api-contracts/extension-kernel";
import { contributionAliases, normalizeExtensionSources } from "pstdio-extensions";
import type { CachedSource, LoadableExtensionSource } from "./project-extension-runtime-sources";

// Asset requests need a declared entry, not a fresh mutable contribution registry for every chunk.
// The source loader still owns freshness and conflict admission; publication is resolved separately.
export const createSourceWebviewReader = (load: (source: LoadableExtensionSource) => Promise<CachedSource | null>) => {
  const projections = new WeakMap<
    CachedSource,
    { entries: Map<string, PackageAssetDescriptor>; aliases: ReadonlyMap<string, string> }
  >();
  return async (source: LoadableExtensionSource, requestedId: string) => {
    const record = await load(source);
    if (!record) return null;
    let projection = projections.get(record);
    if (!projection) {
      const runtime = normalizeExtensionSources([record.source], record.diagnostics);
      const entries = new Map<string, PackageAssetDescriptor>();
      for (const view of runtime.views) {
        const body = view.contribution.body;
        if (body.kind === "webview") entries.set(view.id, { ...body.entry });
      }
      projection = { entries, aliases: contributionAliases(runtime) };
      projections.set(record, projection);
    }
    const id = projection.aliases.get(requestedId) ?? requestedId;
    const entry = projection.entries.get(id);
    return entry ? { id, entry: { ...entry } } : null;
  };
};
