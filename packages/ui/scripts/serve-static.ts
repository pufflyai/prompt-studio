import { extname, join, resolve } from "node:path";

const [rootArg, portArg] = process.argv.slice(2);

if (!rootArg || !portArg) {
  throw new Error("Usage: bun scripts/serve-static.ts <root> <port>");
}

const root = resolve(rootArg);
const port = Number(portArg);

const mimeTypes: Record<string, string> = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".map": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const resolvePath = (pathname: string) => {
  const decoded = decodeURIComponent(pathname);
  const relativePath = decoded === "/" ? "index.html" : decoded.slice(1);
  const filePath = resolve(join(root, relativePath));

  if (!filePath.startsWith(root)) {
    return null;
  }

  return filePath;
};

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    const filePath = resolvePath(url.pathname);
    if (!filePath) return new Response("Not found", { status: 404 });

    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      const fallback = Bun.file(join(root, "index.html"));
      return new Response(fallback, { headers: { "content-type": "text/html" } });
    }

    const contentType = mimeTypes[extname(filePath)] ?? "application/octet-stream";
    return new Response(file, { headers: { "content-type": contentType } });
  },
});

console.info(`Serving ${root} on http://localhost:${port}`);
