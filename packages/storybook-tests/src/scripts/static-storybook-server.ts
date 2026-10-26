import { existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";

export const serveStaticStorybook = (directory: string, port: number) => {
  const root = resolve(directory);
  if (!existsSync(join(root, "iframe.html"))) throw new Error(`Prebuilt Storybook not found: ${root}`);
  return Bun.serve({
    hostname: "127.0.0.1",
    port,
    async fetch(request) {
      const pathname = decodeURIComponent(new URL(request.url).pathname);
      const path = resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
      if (!path.startsWith(root + sep)) return new Response(null, { status: 404 });
      const file = Bun.file(path);
      if (!(await file.exists())) return new Response(null, { status: 404 });
      return new Response(file);
    },
  });
};

if (import.meta.main) {
  const [directory, port] = process.argv.slice(2);
  if (!directory || !port) throw new Error("usage: static-storybook-server.ts <directory> <port>");
  console.log(`Serving prebuilt Storybook at ${serveStaticStorybook(directory, Number(port)).url}`);
}
