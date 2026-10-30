import { resolve, sep } from "node:path";

const root = resolve(import.meta.dir, "../../../../__test-tmp__/native-canvas-verification/dist");
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.CANVAS_PREVIEW_PORT ?? 43187),
  async fetch(request) {
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
