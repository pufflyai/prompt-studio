import payload from "../catalog/generated/frame-bundle";
import { type FramePayload, selectFrameBootstrap } from "./selection";

export type FrameBootstrap = FramePayload<Blob>;
export type FrameArchive = FramePayload<string>;
const archive: FrameArchive = payload;
const prepared = new Map<string, Promise<FrameBootstrap>>();
const decoded = new Map<string, Promise<Blob>>();
let inherited: ((source: string) => Promise<FrameBootstrap>) | undefined;
export const installFrameBootstrap = (load: (source: string) => Promise<FrameBootstrap>) => {
  inherited = load;
  prepared.clear();
};
const decode = (data: string, type: string) => {
  const key = `${type}:${data}`;
  let result = decoded.get(key);
  if (!result) {
    result = (async () => {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      // Avoid allocating an iterator value and invoking a callback for every archive byte.
      for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      return new Blob([await new Response(stream).arrayBuffer()], { type });
    })();
    decoded.set(key, result);
  }
  return result;
};
export const frameBootstrap = (source: string) => {
  let result = prepared.get(source);
  if (!result) {
    result = inherited
      ? inherited(source)
      : (async () => {
          const selected = selectFrameBootstrap(archive, source);
          const scripts = await Promise.all(
            Object.entries(selected.scripts).map(
              async ([name, data]) => [name, await decode(data, "text/javascript")] as const,
            ),
          );
          const styles = await Promise.all(selected.styles.map((data) => decode(data, "text/css")));
          return { ...selected, scripts: Object.fromEntries(scripts), styles };
        })();
    prepared.set(source, result);
  }
  return result;
};

// Each sandbox has an opaque origin. Transfer immutable blobs and create URLs in
// their consuming document; ancestor blob URLs cannot cross this boundary.
const bootDocument = (protocol: string) => {
  let started = false;
  window.addEventListener("message", (event) => {
    const message = event.data;
    if (event.source !== window.parent || message?.protocol !== protocol || message.type !== "bootstrap" || started)
      return;
    started = true;
    const data: Pick<FrameBootstrap, "scripts" | "styles" | "entry"> = message.assets;
    const imports = Object.fromEntries(
      Object.entries(data.scripts).map(([name, blob]) => [`canvas-preview:${name}`, URL.createObjectURL(blob)]),
    );
    for (const blob of data.styles) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = URL.createObjectURL(blob);
      document.head.append(link);
    }
    const map = document.createElement("script");
    map.type = "importmap";
    map.textContent = JSON.stringify({ imports });
    document.head.append(map);
    const entry = document.createElement("script");
    entry.type = "module";
    entry.addEventListener("error", () =>
      window.parent.postMessage(
        { protocol, nonce: message.nonce, type: "error", message: "Preview runtime failed to load" },
        "*",
      ),
    );
    entry.textContent = `import ${JSON.stringify(data.entry)};`;
    document.body.append(entry);
  });
  window.parent.postMessage({ protocol, type: "bootstrap" }, "*");
};
export const frameDocument = () =>
  `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;overflow:hidden}#root{display:flow-root;min-width:0}</style></head><body><div id="root"></div><script>(${bootDocument.toString()})("pstdio.canvas.preview");</script></body></html>`;
