import type { FrameBootstrap } from "@pstdio/canvas";

// Each sandbox has an opaque origin. Transfer immutable blobs and create URLs in
// their consuming document; ancestor blob URLs cannot cross this boundary.
const bootDocument = (protocol: string) => {
  let started = false;
  window.addEventListener("message", (event) => {
    const message = event.data;
    if (event.source !== window.parent || message?.protocol !== protocol || message.type !== "bootstrap" || started)
      return;
    started = true;
    performance.mark("canvas:bootstrap-received");
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
    entry.addEventListener("error", () =>
      window.parent.postMessage(
        { protocol, nonce: message.nonce, type: "error", message: "Preview runtime failed to load" },
        "*",
      ),
    );
    entry.textContent = `import ${JSON.stringify(`canvas-preview:${data.entry}`)};`;
    document.body.append(entry);
  });
  window.parent.postMessage({ protocol, type: "bootstrap" }, "*");
};
export const frameDocument = () =>
  `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;overflow:hidden}#root{display:flow-root;min-width:0}</style></head><body><div id="root"></div><script>(${bootDocument.toString()})("pstdio.canvas.preview");</script></body></html>`;
