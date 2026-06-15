/**
 * Storybook mount-smoke runner.
 *
 * Builds the static storybook bundle, serves it locally, and runs
 * `@storybook/test-runner` against every story. The test-runner mounts each
 * story in a Playwright browser and fails on any runtime error during render —
 * stories that declare a `play` function additionally run their play body.
 *
 * This is the "mount-smoke" tier referenced in .pstdio/docs/contributing/tests.md
 * and tracked from PS-69. See also storybook-play-coverage.md.
 */
import { existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const cwd = resolve(import.meta.dir, "..");
const staticDir = join(cwd, "storybook-static");
const port = Number(process.env.STORYBOOK_SMOKE_PORT ?? "6006");
const skipBuild = process.env.SKIP_STORYBOOK_BUILD === "1";

if (!skipBuild) {
  console.info("[mount-smoke] building storybook...");
  const build = Bun.spawn(["bun", "run", "build-storybook", "--quiet"], {
    cwd,
    stdio: ["inherit", "inherit", "inherit"],
  });
  const code = await build.exited;
  if (code !== 0) {
    console.error("[mount-smoke] storybook build failed");
    process.exit(code);
  }
}

if (!existsSync(staticDir)) {
  console.error(`[mount-smoke] storybook-static not found at ${staticDir}`);
  process.exit(1);
}

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
  const relative = decoded === "/" ? "index.html" : decoded.slice(1);
  const filePath = resolve(join(staticDir, relative));
  if (!filePath.startsWith(staticDir)) return null;
  return filePath;
};

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    const filePath = resolvePath(url.pathname);
    if (!filePath) return new Response("Not found", { status: 404 });

    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      const fallback = Bun.file(join(staticDir, "index.html"));
      return new Response(fallback, { headers: { "content-type": "text/html" } });
    }

    const contentType = mimeTypes[extname(filePath)] ?? "application/octet-stream";
    return new Response(file, { headers: { "content-type": contentType } });
  },
});

console.info(`[mount-smoke] serving storybook-static on ${server.url}`);

const url = `http://127.0.0.1:${port}`;
const test = Bun.spawn(["bun", "x", "test-storybook", "--url", url, "--browsers", "chromium"], {
  cwd,
  stdio: ["inherit", "inherit", "inherit"],
});

const exitCode = await test.exited;
server.stop(true);
process.exit(exitCode);
