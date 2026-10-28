import { resolve, sep } from "node:path";
import manifest from "../src/catalog/generated/frame-manifest.json";
import { readFrameAssets } from "../src/frames/module-graph";

const root = resolve(import.meta.dir, "../../../__test-tmp__/native-canvas-verification/dist");
const extensionRoot = resolve(import.meta.dir, "..");
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type" };
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.CANVAS_PREVIEW_PORT ?? 43187),
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers });
    if (new URL(request.url).pathname === "/preview-assets") {
      try {
        const result = await readFrameAssets(manifest, await request.json(), (path) =>
          Bun.file(resolve(extensionRoot, path)).text(),
        );
        return Response.json(result, { headers });
      } catch (error) {
        return new Response(error instanceof Error ? error.message : String(error), { status: 400, headers });
      }
    }
    const path = resolve(
      root,
      `.${new URL(request.url).pathname === "/" ? "/index.html" : new URL(request.url).pathname}`,
    );
    if (!path.startsWith(root + sep)) return new Response(null, { status: 404 });
    const file = Bun.file(path);
    if (!(await file.exists())) return new Response(null, { status: 404 });
    return new Response(file, { headers: { "Access-Control-Allow-Origin": "*" } });
  },
});
console.log(`Canvas previews: ${server.url}`);
