import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname, resolve } from "node:path";
import type { ConsoleMessage, Request as PreviewRequest, Route as PreviewRoute } from "@playwright/test";
import { checkCanvasInteractions } from "./grouped-interaction-check";
import { checkIntrinsicDocumentation, profilePopulatedCanvas } from "./native-documentation-check";
import { checkCanvasVariants } from "./native-variant-check";
import { verificationCanvases } from "./native-verification-fixtures";
import { repoRoot } from "./story-catalog";

const uiRequire = createRequire(resolve(repoRoot, "packages/ui/package.json"));
const browserRequire = createRequire(resolve(repoRoot, ".pstdio/extensions/canvas/package.json"));
const { build } = await import(uiRequire.resolve("vite"));
const { chromium } = await import(browserRequire.resolve("@playwright/test"));
const root = resolve(repoRoot, "__test-tmp__/native-canvas-verification");
await mkdir(root, { recursive: true });
await writeFile(
  resolve(root, "canvas.html"),
  `<html><head><title>Native Canvas verification</title><style>html,body,#root{margin:0;width:100%;height:100%}</style></head><body><div id="root"></div><script type="module" src="${resolve(import.meta.dir, "native-verification-entry.tsx")}"></script></body></html>`,
);
await writeFile(
  resolve(root, "index.html"),
  '<html><head><style>html,body,iframe{margin:0;width:100%;height:100%;border:0}</style></head><body><iframe data-verification-host title="UI Canvas" sandbox="allow-scripts allow-forms" ></iframe><script>document.querySelector("iframe").src="/canvas.html"+location.search</script></body></html>',
);
await build({
  configFile: false,
  root,
  publicDir: false,
  logLevel: "error",
  resolve: { dedupe: ["react", "react-dom", "@chakra-ui/react", "@emotion/react", "@pstdio/ui", "@pstdio/sdk"] },
  esbuild: { jsx: "automatic" },
  build: {
    outDir: resolve(root, "dist"),
    assetsInlineLimit: () => true,
    minify: true,
    rollupOptions: { input: { index: resolve(root, "index.html"), canvas: resolve(root, "canvas.html") } },
  },
});
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = resolve(root, "dist", `.${path}`);
    if (!file.startsWith(`${resolve(root, "dist")}/`)) return new Response(null, { status: 404 });
    const body = Bun.file(file);
    if (!(await body.exists())) return new Response(null, { status: 404 });
    return new Response(body, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": extname(file) === ".js" ? "text/javascript" : body.type,
      },
    });
  },
});
const selected = new Set(process.argv.slice(2));
const targets = verificationCanvases.filter(
  (canvas) => !selected.size || selected.has(canvas.id) || selected.has(canvas.group ?? "native"),
);
const browser = await chromium.launch({ headless: true });
let cancelled = false;
const cancel = () => {
  cancelled = true;
  void browser.close().catch(() => {});
};
process.once("SIGINT", cancel);
process.once("SIGTERM", cancel);
interface Result {
  id: string;
  previews: number;
  status: string;
  errors: string[];
  durationMs: number;
  details?: unknown;
  variants: number;
}
const results: Result[] = [];
const reportPath = resolve(root, "results.json");
let next = 0;
const worker = async () => {
  while (!cancelled && next < targets.length) {
    const canvas = targets[next++];
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(30_000);
    await page.route("**/*", (route: PreviewRoute) => {
      const request = route.request();
      if (!["GET", "HEAD"].includes(request.method()) && !request.url().startsWith(server.url.origin))
        return route.abort();
      return route.continue();
    });
    const errors: string[] = [];
    const diagnostics: string[] = [];
    page.on("console", (message: ConsoleMessage) => {
      if (["warning", "error"].includes(message.type())) diagnostics.push(message.text());
    });
    page.on("requestfailed", (request: PreviewRequest) =>
      diagnostics.push(`${request.url()}: ${request.failure()?.errorText}`),
    );
    page.on("pageerror", (error: Error) => errors.push(error.stack || error.message));
    page.on("request", (request: PreviewRequest) => {
      if (!["GET", "HEAD"].includes(request.method()) && !request.url().startsWith(server.url.origin)) {
        errors.push(`Unexpected preview mutation: ${request.method()} ${request.url()}`);
      }
    });
    const start = performance.now();
    let details: unknown;
    let variants = 0;
    try {
      await page.goto(`${server.url}?canvas=${encodeURIComponent(canvas.id)}`, { waitUntil: "domcontentloaded" });
      const hostFrame = await page.locator("[data-verification-host]").elementHandle();
      const surface = (await hostFrame!.contentFrame())!;
      await surface.waitForFunction(() => {
        const loading = document.querySelector("[data-ui-canvas-loading]");
        return document.querySelector("[data-canvas-item]") && !loading;
      });
      await surface.evaluate(() => document.fonts.ready);
      errors.push(...(await surface.locator("[data-ui-canvas-error]").allTextContents()));
      const missing =
        (await surface
          .locator("[data-canvas-stage]")
          .first()
          .locator(":scope > [data-canvas-item] > [data-canvas-preview]")
          .count()) !== canvas.items.length;
      if (missing) errors.push("A source preview is missing");
      details = await checkCanvasInteractions(surface, page, canvas);
      if (canvas.id === "documentation-contract") details = await checkIntrinsicDocumentation(surface);
      if (canvas.id === "verification-populated") details = await profilePopulatedCanvas(surface);
      variants = await checkCanvasVariants(surface, canvas);
    } catch (error) {
      errors.push(String(error));

      await page.screenshot({ path: resolve(root, `${canvas.id}.png`), fullPage: true }).catch(() => {});
      const html = await page.content().catch(() => "");
      await writeFile(resolve(root, `${canvas.id}.html`), html).catch(() => {});
    } finally {
      await page.close().catch(() => {});
    }
    const result = {
      id: canvas.id,
      previews: canvas.items.length,
      variants,
      status: errors.length ? "error" : "ready",
      errors,
      ...(errors.length ? { diagnostics } : {}),
      durationMs: performance.now() - start,
      details,
    };
    results.push(result);
    if (errors.length) console.log(`FAIL ${canvas.id}: ${errors[0]?.slice(0, 180)}`);
    if (results.length % 25 === 0) {
      await writeFile(
        reportPath,
        JSON.stringify(
          {
            total: targets.length,
            checked: results.length,
            failed: results.filter((result) => result.status === "error").length,
            results,
          },
          null,
          2,
        ),
      );
      console.log(`${results.length}/${targets.length} canvases checked`);
    }
  }
};
try {
  await Promise.all([worker(), worker()]);
} finally {
  await browser.close().catch(() => {});
  server.stop();
  process.removeListener("SIGINT", cancel);
  process.removeListener("SIGTERM", cancel);
}
await writeFile(
  reportPath,
  JSON.stringify(
    {
      total: targets.length,
      checked: results.length,
      failed: results.filter((result) => result.status === "error").length,
      results,
    },
    null,
    2,
  ),
);
console.log(reportPath);
if (cancelled || results.length !== targets.length || results.some((result) => result.status === "error"))
  process.exitCode = 1;
