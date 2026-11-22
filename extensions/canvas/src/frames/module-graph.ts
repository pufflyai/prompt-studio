import type { FrameManifest } from "@pstdio/canvas";

export interface FrameAssetRequest {
  source: string;
  cached: string[];
}
export interface FrameAssetResponse {
  entry: string;
  modules: string[];
  styles: string[];
  fonts?: string[];
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
  const fonts = [...new Set(styles.flatMap((name) => manifest.modules[name].imports))];
  // Style names from Bun can coincide across archive formats. Cache packed styles by their actual bytes.
  const key = (name: string) => {
    const style = manifest.modules[name];
    return name.endsWith(".css") && style?.imports.length ? `${style.file}.css` : name;
  };
  const cached = new Set(request.cached);
  const packs = new Map<string, Promise<Record<string, string>>>();
  const files = await Promise.all(
    [...modules, ...styles, ...fonts]
      .filter((name) => !cached.has(key(name)))
      .map(async (name) => {
        const module = manifest.modules[name];
        if (!module) throw new Error(`Missing compiled preview asset: ${name}`);
        if (!module.file.endsWith(".fonts.json")) return [key(name), await readText(module.file)] as const;
        let pack = packs.get(module.file);
        if (!pack) {
          pack = readText(module.file).then((text) => JSON.parse(text) as Record<string, string>);
          packs.set(module.file, pack);
        }
        const data = (await pack)[name];
        if (typeof data !== "string") throw new Error(`Missing archived font: ${name}`);
        return [name, data] as const;
      }),
  );
  return { entry: manifest.entry, modules, styles: styles.map(key), fonts, files: Object.fromEntries(files) };
};
