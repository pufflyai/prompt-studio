import { join, resolve, sep } from "node:path";
import type { CanvasBuildManifest } from "@pstdio/canvas";
import { readFrameAssets } from "../src/frames/module-graph";
import { verificationBuild, verificationRoot } from "./verification-paths";

const root = resolve(verificationRoot, "dist");
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type" };
const manifest = (await Bun.file(join(verificationBuild, "manifest.json")).json()) as CanvasBuildManifest;
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.CANVAS_PREVIEW_PORT ?? 43187),
  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    if (request.method === "OPTIONS") return new Response(null, { headers });
    if (pathname === "/manifest.json") return Response.json(manifest, { headers });
    if (pathname === "/preview-assets") {
      try {
        const result = await readFrameAssets(manifest.frames, await request.json(), (path) =>
          Bun.file(join(verificationBuild, path)).text(),
        );
        return Response.json(result, { headers });
      } catch (error) {
        return new Response(error instanceof Error ? error.message : String(error), { status: 400, headers });
      }
    }
    const path = resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    if (!path.startsWith(root + sep)) return new Response(null, { status: 404 });
    const file = Bun.file(path);
    if (!(await file.exists())) return new Response(null, { status: 404 });
    return new Response(file, { headers: { "Access-Control-Allow-Origin": "*" } });
  },
});
console.log(`Canvas previews: ${server.url}`);
