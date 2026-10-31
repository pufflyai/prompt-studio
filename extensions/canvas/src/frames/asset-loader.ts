import type { FrameBootstrap } from "@pstdio/canvas";
import type { FrameAssetRequest, FrameAssetResponse } from "./module-graph";

/** Loads the code for one canvas; a new revision of that canvas loads its new modules. */
export type FrameLoader = (source: string, revision?: string) => Promise<FrameBootstrap>;
export const createFrameAssetLoader = (fetchAssets: (request: FrameAssetRequest) => Promise<FrameAssetResponse>) => {
  const files = new Map<string, Promise<Blob>>();
  const previews = new Map<string, Promise<FrameBootstrap>>();
  const prepare = async (source: string) => {
    const response = await fetchAssets({ source, cached: [...files.keys()] });
    for (const [name, encoded] of Object.entries(response.files)) {
      if (files.has(name)) continue;
      const decode = async () => {
        const binary = atob(encoded);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
        return new Blob([await new Response(stream).arrayBuffer()], {
          type: name.endsWith(".css") ? "text/css" : "text/javascript",
        });
      };
      files.set(
        name,
        decode().catch((error) => {
          files.delete(name);
          throw error;
        }),
      );
    }
    const read = async (name: string) => {
      const file = files.get(name);
      if (!file) throw new Error(`Preview asset was not supplied: ${name}`);
      return file;
    };
    return {
      entry: response.entry,
      scripts: Object.fromEntries(await Promise.all(response.modules.map(async (name) => [name, await read(name)]))),
      styles: await Promise.all(response.styles.map(read)),
    };
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
    let prepared = previews.get(key);
    if (!prepared) {
      prepared = (async () => {
        // Decode the common runtime once before concurrent previews request their own modules.
        await prepareRuntime();
        return prepare(source);
      })().catch((error) => {
        previews.delete(key);
        throw error;
      });
      previews.set(key, prepared);
    }
    return prepared;
  };
  return load;
};
