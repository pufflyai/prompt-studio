import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PencilDesign } from "../src/catalog/pencil/design";
import type { DesignDocument } from "../src/catalog/pencil/model";
import { generatedRoot, repoRoot } from "./story-catalog";

const require = createRequire(resolve(repoRoot, ".pstdio/extensions/canvas/package.json"));
const { chromium } = await import(require.resolve("@playwright/test"));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const failures: string[] = [];
page.on("pageerror", (error: Error) => failures.push(error.message));
let html = "";
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: () => new Response(html, { headers: { "Content-Type": "text/html" } }),
});
const catalog = await Bun.file(resolve(generatedRoot, "designs.json")).json();
const { default: fontData } = await import(resolve(generatedRoot, "fonts-design.ts"));
const { fonts } = JSON.parse(gunzipSync(Buffer.from(fontData, "base64")).toString());
const results = [];
try {
  for (const file of catalog) {
    const { default: packed } = await import(resolve(generatedRoot, `${file.id}-design.ts`));
    const document = JSON.parse(gunzipSync(Buffer.from(packed, "base64")).toString()) as DesignDocument;
    document.fonts = fonts;
    for (const root of file.roots) {
      try {
        const markup = renderToStaticMarkup(createElement(PencilDesign, { document, rootId: root.id }));
        html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0}*{box-sizing:border-box}</style></head><body>${markup}</body></html>`;
        await page.goto(new URL(`/${file.id}/${root.id}`, server.url).href);
        await page.evaluate(() => window.document.fonts.ready);
        const metrics = await page.locator(`[data-design-node="${root.id}"]`).evaluate((element: HTMLElement) => ({
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
          nodes: element.querySelectorAll("[data-design-node]").length + 1,
        }));
        if (!metrics.width || !metrics.height) throw new Error("Design has no visible bounds");
        results.push({ source: file.source, id: root.id, name: root.name, status: "ready", ...metrics });
        if (process.argv.includes(root.id))
          await page.screenshot({ path: resolve(repoRoot, `__test-tmp__/design-${root.id}.png`) });
      } catch (error) {
        results.push({ source: file.source, id: root.id, name: root.name, status: "error", error: String(error) });
      }
    }
    console.log(`${file.name}: ${file.roots.length} checked`);
  }
} finally {
  await browser.close();
  server.stop();
}
await writeFile(
  resolve(repoRoot, "__test-tmp__/ui-canvas-design-results.json"),
  `${JSON.stringify({ total: results.length, failed: results.filter((result) => result.status === "error").length, pageErrors: failures, results }, null, 2)}\n`,
);
console.log(
  `${results.length} designs checked, ${results.filter((result) => result.status === "error").length} failed, ${failures.length} browser errors`,
);
if (failures.length || results.some((result) => result.status === "error")) process.exitCode = 1;
