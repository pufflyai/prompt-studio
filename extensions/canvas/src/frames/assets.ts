import archive from "../catalog/generated/frame-bundle";
import type { FrameGraph } from "./selection";

export interface FrameBootstrap {
  scripts: Record<string, Blob>;
  styles: Blob[];
  entry: string;
  graph: FrameGraph;
}
let prepared: Promise<FrameBootstrap> | undefined;
export const installFrameBootstrap = (bootstrap: FrameBootstrap) => {
  prepared = Promise.resolve(bootstrap);
};
export const frameBootstrap = () => {
  prepared ??= (async () => {
    const binary = atob(archive);
    const bytes = new Uint8Array(binary.length);
    // Avoid allocating an iterator value and invoking a callback for every archive byte.
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const data = JSON.parse(await new Response(stream).text()) as {
      scripts: Record<string, string>;
      styles: string[];
      entry: string;
      graph: FrameGraph;
    };
    return {
      scripts: Object.fromEntries(
        Object.entries(data.scripts).map(([name, source]) => [name, new Blob([source], { type: "text/javascript" })]),
      ),
      styles: data.styles.map((style) => new Blob([style], { type: "text/css" })),
      entry: `canvas-preview:${data.entry}`,
      graph: data.graph,
    };
  })();
  return prepared;
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
    const data: FrameBootstrap = message.bootstrap;
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
    entry.textContent = `import ${JSON.stringify(data.entry)};`;
    document.body.append(entry);
  });
  window.parent.postMessage({ protocol, type: "bootstrap" }, "*");
};
export const frameDocument = () =>
  `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;overflow:hidden}#root{display:flow-root;min-width:0}</style></head><body><div id="root"></div><script>(${bootDocument.toString()})("pstdio.canvas.preview");</script></body></html>`;
