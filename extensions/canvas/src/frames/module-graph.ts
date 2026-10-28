export interface FrameManifest {
  entry: string;
  catalog: string;
  sources: Record<string, { script: string; project?: string }>;
  modules: Record<string, { file: string; imports: string[]; dynamicImports: string[]; bytes: number; css?: string[] }>;
  styles: string[];
}
export interface FrameAssetRequest {
  source: string;
  cached: string[];
}
export interface FrameAssetResponse {
  entry: string;
  modules: string[];
  styles: string[];
  files: Record<string, string>;
}

export const selectFrameModules = (manifest: FrameManifest, source: string) => {
  const selected = source === "$runtime" ? undefined : manifest.sources[source];
  if (source !== "$runtime" && !Object.hasOwn(manifest.sources, source))
    throw new Error(`Missing preview source: ${source}`);
  const visited = new Map<string, number>();
  const visit = (name: string, dynamic: boolean) => {
    const mode = dynamic && name !== manifest.catalog ? 1 : 0;
    if ((visited.get(name) ?? -1) >= mode) return;
    const module = manifest.modules[name];
    if (!module) throw new Error(`Missing compiled preview module: ${name}`);
    visited.set(name, mode);
    for (const dependency of module.imports) visit(dependency, Boolean(mode));
    if (mode) for (const dependency of module.dynamicImports) visit(dependency, true);
  };
  visit(manifest.entry, false);
  if (selected) {
    visit(selected.script, true);
    if (selected.project) visit(selected.project, true);
  }
  return [...visited.keys()];
};

export const readFrameAssets = async (
  manifest: FrameManifest,
  request: FrameAssetRequest,
  readText: (path: string) => Promise<string>,
) => {
  if (!Array.isArray(request.cached) || request.cached.some((name) => typeof name !== "string"))
    throw new Error("Cached preview modules must be an array of names");
  const modules = selectFrameModules(manifest, request.source);
  const requiredStyles = new Set(modules.flatMap((name) => manifest.modules[name].css ?? []));
  const styles = manifest.styles.filter((name) => requiredStyles.has(name));
  const cached = new Set(request.cached);
  const files = await Promise.all(
    [...modules, ...styles]
      .filter((name) => !cached.has(name))
      .map(async (name) => {
        const module = manifest.modules[name];
        if (!module) throw new Error(`Missing compiled preview asset: ${name}`);
        return [name, await readText(module.file)] as const;
      }),
  );
  return { entry: manifest.entry, modules, styles, files: Object.fromEntries(files) };
};
