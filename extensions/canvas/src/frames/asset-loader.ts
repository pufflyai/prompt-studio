import type { FrameBootstrap } from "@pstdio/canvas";
import { restoreFontStyle } from "./font-styles";
import type { FrameAssetRequest, FrameAssetResponse } from "./module-graph";

/** Loads the code for one canvas; a new revision of that canvas loads its new modules. */
export type FrameLoader = (source: string, revision?: string) => Promise<FrameBootstrap>;
export const createFrameAssetLoader = (fetchAssets: (request: FrameAssetRequest) => Promise<FrameAssetResponse>) => {
  const files = new Map<string, Promise<Blob>>();
  const previews = new Map<string, Promise<FrameBootstrap>>();
  const current = new Map<string, string>();
  const graphs = new Map<string, string[]>();
  // Keep the current and previous source warm as the shared viewer follows navigation.
  const retainedSources = 2;
  let pending = 0;
  const prepare = async (source: string, key = "") => {
    // An in-flight request owns its snapshot even if another source finishes a new build.
    const available = new Map(files);
    pending += 1;
    try {
      const response = await fetchAssets({ source, cached: [...available.keys()] });
      const fonts = new Set(response.fonts);
      for (const [name, encoded] of Object.entries(response.files)) {
        if (available.has(name)) continue;
        const decode = async () => {
          if (fonts.has(name)) {
            const extension = name.slice(name.lastIndexOf(".") + 1);
            const mime = extension === "eot" ? "application/vnd.ms-fontobject" : `font/${extension}`;
            return new Blob([`data:${mime};base64,`, encoded]);
          }
          const bytes = Uint8Array.fromBase64
            ? Uint8Array.fromBase64(encoded)
            : Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
          const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
          return new Blob([await new Response(stream).arrayBuffer()], {
            type: name.endsWith(".css") ? "text/css" : "text/javascript",
          });
        };
        const decoded = decode().catch((error) => {
          if (files.get(name) === decoded) files.delete(name);
          throw error;
        });
        files.set(name, decoded);
        available.set(name, decoded);
      }
      const read = async (name: string) => {
        const file = available.get(name);
        if (!file) throw new Error(`Preview asset was not supplied: ${name}`);
        return file;
      };
      const bootstrap = {
        entry: response.entry,
        scripts: Object.fromEntries(await Promise.all(response.modules.map(async (name) => [name, await read(name)]))),
        styles: await Promise.all(
          response.styles.map(async (name) => {
            const style = await read(name);
            return fonts.size ? restoreFontStyle(style, read) : style;
          }),
        ),
      };
      if ((current.get(source) ?? "") === key) graphs.set(source, [...response.modules, ...response.styles, ...fonts]);
      return bootstrap;
    } finally {
      pending -= 1;
      if (!pending) {
        const retained = new Set([...graphs.values()].flat());
        for (const name of files.keys()) if (!retained.has(name)) files.delete(name);
      }
    }
  };
  let runtime: Promise<FrameBootstrap> | undefined;
  const prepareRuntime = () => {
    runtime ??= prepare("$runtime").catch((error) => {
      runtime = undefined;
      throw error;
    });
    return runtime;
  };
  const load: FrameLoader = (source, revision = "") => {
    if (source === "$runtime") return prepareRuntime();
    const key = `${source}@${revision}`;
    const previous = current.get(source);
    if (previous !== key) {
      if (previous) previews.delete(previous);
      graphs.delete(source);
    }
    current.delete(source);
    current.set(source, key);
    if (current.size > retainedSources) {
      const [oldestSource, oldestKey] = current.entries().next().value!;
      current.delete(oldestSource);
      previews.delete(oldestKey);
      graphs.delete(oldestSource);
    }
    let prepared = previews.get(key);
    if (!prepared) {
      // A source graph already includes the runtime; the first frame can fetch both in one request.
      prepared = prepare(source, key).catch((error) => {
        if (previews.get(key) === prepared) previews.delete(key);
        throw error;
      });
      previews.set(key, prepared);
    }
    return prepared;
  };
  return load;
};
