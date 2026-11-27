import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import {
  runtimeAuthorization,
  signInBrowser,
  startPackagedServe,
  stopProcess,
} from "../packaged/packaged-serve-helpers";

declare global {
  interface Window {
    panelStart: number;
    panelElapsed: number;
  }
}

const home = mkdtempSync(join(tmpdir(), "pstdio-large-module-"));
const binary = process.env.PANEL_BINARY!;
const label = process.env.PANEL_LABEL!;
const parts = 64,
  partBytes = 65536;
let runtime: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  runtime = await startPackagedServe(
    home,
    { PSTDIO_DEFAULT_EXTENSIONS: "[]", PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1" },
    binary,
  );
  const headers = { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" };
  const folder = join(home, "project");
  mkdirSync(folder);
  const response = await fetch(`${runtime.baseUrl}/v1/projects`, {
    method: "POST",
    headers,
    body: JSON.stringify(folderProjectInput({ name: "Large webview" }, folder)),
  });
  if (!response.ok) throw new Error(`Project ${response.status}`);
  const project = (await response.json()) as { id: string };
  const source = join(folder, "large-view");
  mkdirSync(source);
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "large-webview",
      publisher: "test",
      version: "1.0.0",
      type: "module",
      main: "./extension.ts",
      engines: { pstdio: "^0.5.0 || ^0.6.0" },
    }),
  );
  writeFileSync(
    join(source, "extension.ts"),
    `const mode={kind:"mode",id:"project",extensionId:"pstdio"};const ref={kind:"view",id:"page"};const page={kind:"page",id:"large"};
 export default {views:[{id:"page",ref,title:"Large webview",body:{kind:"webview",entry:{kind:"package-asset",path:"./view.ts",baseUrl:import.meta.url}}}],
 pages:[{id:"large",ref:page,title:"Large webview",path:"large",mode,main:{kind:"view",presentation:"page",view:ref,cardinality:"one"},slots:[],panels:{}}],
 navigationItems:[{id:"large",ref:{kind:"navigation-item",id:"large"},owner:mode,slot:"content",label:"Large webview",action:{kind:"page",page}}]};`,
  );
  for (let part = 0; part < parts; part++) {
    let payload = "";
    for (let block = 0; payload.length < partBytes; block++)
      payload += createHash("sha256").update(`${part}:${block}`).digest("hex");
    writeFileSync(
      join(source, `part-${part}.ts`),
      `export const payload=${JSON.stringify(payload.slice(0, partBytes))};`,
    );
  }
  writeFileSync(
    join(source, "view.ts"),
    `export default {async mount(root){
 const parts=await Promise.all([${Array.from({ length: parts }, (_, i) => `import("./part-${i}.ts")`).join(",")}]);
 const bytes=parts.reduce((sum,part)=>sum+part.payload.length,0);if(bytes!==${parts * partBytes})throw new Error("Incomplete module payload");
 const heading=document.createElement("h1");heading.textContent="Large view ready";heading.dataset.largeReady=String(bytes);
 const note=document.createElement("p");note.textContent="64 chunks · 4 MiB of JavaScript module payload";
 const button=document.createElement("button");button.textContent="Interact";let count=0;button.onclick=()=>button.textContent="Interactions: "+(++count);
 root.append(heading,note,button);return()=>root.replaceChildren();}};`,
  );
  const install = await fetch(`${runtime.baseUrl}/v1/projects/${project.id}/extensions/install`, {
    method: "POST",
    headers,
    body: JSON.stringify({ source: { kind: "project-folder", path: "large-view" } }),
  });
  if (!install.ok) throw new Error(`Install ${install.status}: ${await install.text()}`);
  const installed = (await install.json()) as { extension?: { status?: string } };
  console.log(
    "LARGE_VIEW_FIXTURE",
    JSON.stringify({ parts, payloadBytes: parts * partBytes, status: installed.extension?.status }),
  );
  browser = await chromium.launch({ headless: true, channel: "chromium" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(180000);
  await page.addInitScript(
    ({ projectId }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    },
    { projectId: project.id },
  );
  await page.addInitScript(() => {
    if (window === window.top) {
      window.addEventListener("message", (event) => {
        if (event.data?.diagnostic !== "large-view-painted") return;
        const frame = [...document.querySelectorAll("iframe")].find((f) => f.contentWindow === event.source);
        if (!frame || frame.title !== "Large webview" || !frame.getClientRects().length) return;
        window.panelElapsed = event.data.at - (performance.timeOrigin + window.panelStart);
      });
      return;
    }
    let observed = false;
    new MutationObserver(() => {
      if (observed) return;
      const target = document.querySelector("[data-large-ready]");
      if (!target?.getClientRects().length) return;
      observed = true;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (target.isConnected && target.getClientRects().length)
            parent.postMessage(
              { diagnostic: "large-view-painted", at: performance.timeOrigin + performance.now() },
              "*",
            );
          else observed = false;
        }),
      );
    }).observe(document, { childList: true, subtree: true, attributes: true });
  });
  const requests: any[] = [];
  page.on("requestfinished", (r) => {
    if (r.url().includes("/assets/")) requests.push(r);
  });
  await signInBrowser(page, runtime.descriptor);
  await page.getByRole("option", { name: "Large webview", exact: true }).waitFor();
  await Bun.sleep(1000);
  await page.evaluate(() => {
    window.panelStart = performance.now();
  });
  await page.getByRole("option", { name: "Large webview", exact: true }).click();
  await page.waitForFunction(() => window.panelElapsed > 0);
  const elapsed = await page.evaluate(() => Math.round(window.panelElapsed));
  const frame = page.frames().find((f) => f !== page.mainFrame() && f.url().includes("/runtime"));
  if (!frame) throw new Error("No large view frame");
  await frame.getByRole("button", { name: "Interact", exact: true }).click();
  await frame.getByRole("button", { name: "Interactions: 1", exact: true }).waitFor();
  const assets = await Promise.all(
    requests
      .filter((r) => r.url().includes("/extensions/webviews/"))
      .map(async (r) => ({ path: new URL(r.url()).pathname, ...(await r.sizes()) })),
  );
  const result = {
    label,
    elapsed,
    browserVersion: browser.version(),
    cohort: process.env.PANEL_COHORT,
    workload: process.env.PANEL_CASE,
    pair: process.env.PANEL_PAIR,
    binary,
    revision: process.env.PANEL_REVISION,
    binarySha256: new Bun.CryptoHasher("sha256").update(await Bun.file(binary).arrayBuffer()).digest("hex"),
    parts,
    payloadBytes: parts * partBytes,
    assetCount: assets.length,
    responseBytes: assets.reduce((sum, a) => sum + a.responseBodySize, 0),
    interaction: "passed",
    at: new Date().toISOString(),
  };
  console.log("PANEL_RESULT", JSON.stringify(result));

  appendFileSync(join(process.env.PANEL_OUTPUT!, "module-results.jsonl"), `${JSON.stringify(result)}\n`);
  await context.close();
} finally {
  await browser?.close();
  if (runtime) await stopProcess(runtime.child);
  rmSync(home, { recursive: true, force: true });
}
