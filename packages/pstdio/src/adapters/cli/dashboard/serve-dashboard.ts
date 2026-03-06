import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

type DashboardConfig = {
  apiBaseUrl: string;
  version?: string;
};

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain",
  ".map": "application/json",
};

export const resolveMimeType = (ext: string) => MIME_TYPES[ext] ?? "application/octet-stream";

export const injectConfig = (html: string, config: DashboardConfig) => {
  const script = `<script>window.__PSTDIO_CONFIG__=${JSON.stringify(config)}</script>`;
  const headClose = "</head>";

  if (!html.includes(headClose)) {
    return html;
  }

  return html.replace(headClose, `${script}${headClose}`);
};

type FileResult = { kind: "file" | "fallback"; filePath: string };

export const resolveFilePath = (root: string, urlPath: string): FileResult | null => {
  const decoded = decodeURIComponent(urlPath);
  const normalized = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const safePath = normalized.startsWith("/") ? normalized.slice(1) : normalized;

  const filePath = join(root, safePath);

  if (!filePath.startsWith(root)) {
    const indexPath = join(root, "index.html");
    return existsSync(indexPath) ? { kind: "fallback", filePath: indexPath } : null;
  }

  if (safePath === "" || safePath === "/") {
    const indexPath = join(root, "index.html");
    return existsSync(indexPath) ? { kind: "file", filePath: indexPath } : null;
  }

  if (existsSync(filePath) && statSync(filePath).isFile()) {
    return { kind: "file", filePath };
  }

  const indexPath = join(root, "index.html");

  if (extname(safePath) === "" && existsSync(indexPath)) {
    return { kind: "fallback", filePath: indexPath };
  }

  return null;
};

type ServeDashboardOptions = {
  root: string;
  port: number;
  host?: string;
  config: DashboardConfig;
};

export const serveDashboard = (options: ServeDashboardOptions) => {
  const { root, port, host = "localhost", config } = options;

  const server = createServer((req, res) => {
    const urlPath = new URL(req.url ?? "/", `http://${host}`).pathname;
    const result = resolveFilePath(root, urlPath);

    if (!result) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
      return;
    }

    const ext = extname(result.filePath);
    const mimeType = resolveMimeType(ext);
    const raw = readFileSync(result.filePath, ext === ".html" ? "utf8" : undefined);

    if (ext === ".html") {
      const html = injectConfig(raw as string, config);
      res.writeHead(200, { "content-type": mimeType });
      res.end(html);
      return;
    }

    res.writeHead(200, { "content-type": mimeType });
    res.end(raw);
  });

  server.listen(port, host);
  return server;
};
