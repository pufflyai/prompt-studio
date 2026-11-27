import { appendFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
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

const home = mkdtempSync(join(tmpdir(), "pstdio-bundled-profile-"));
const binary = process.env.PANEL_BINARY!;
const label = process.env.PANEL_LABEL!;
const recording = Boolean(process.env.PANEL_VIDEO_DIR);
if (recording) mkdirSync(process.env.PANEL_VIDEO_DIR!, { recursive: true });
if (!binary || !label) throw new Error("PANEL_BINARY and PANEL_LABEL required");
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
  const create = await fetch(`${runtime.baseUrl}/v1/projects`, {
    method: "POST",
    headers,
    body: JSON.stringify(folderProjectInput({ name: "Bundled Planner" }, folder)),
  });
  if (!create.ok) throw new Error(`Project creation ${create.status}`);
  const project = (await create.json()) as { id: string };
  const install = await fetch(`${runtime.baseUrl}/v1/projects/${project.id}/extensions/install`, {
    method: "POST",
    headers,
    body: JSON.stringify({ source: { kind: "catalog", name: "pstdio.planner" } }),
  });
  if (!install.ok) throw new Error(`Catalog installation ${install.status}: ${await install.text()}`);
  const cache = join(home, "cache", "extension-revisions", "revisions");
  const releases = [...new Bun.Glob("**/.pstdio-release-runtime.mjs").scanSync(cache)];
  if (releases.length !== 1) throw new Error(`Expected a prebuilt release, got ${releases.length}`);
  console.log("PREBUILT_RELEASE", releases.length);
  const ticket = await fetch(
    `${runtime.baseUrl}/v1/projects/${project.id}/extensions/commands/pstdio.planner.command.create-ticket/execute`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ params: { title: "Review the first release" } }),
    },
  );
  const ticketResult = (await ticket.json()) as { outcome?: { ok?: boolean } };
  if (!ticket.ok || ticketResult.outcome?.ok === false) throw new Error("Ticket creation failed");
  const ticketCount = Number(process.env.PANEL_TICKETS ?? "1");
  for (let offset = 1; offset < ticketCount; offset += 1000) {
    const count = Math.min(1000, ticketCount - offset);
    const tickets = Array.from({ length: count }, (_, i) => ({
      key: `batch-${offset}-${i}`,
      title: `Large project ticket ${offset + i}`,
      ...(i % 10 === 0 ? {} : { parent: `batch-${offset}-${i - (i % 10)}` }),
      ...(i % 4 === 0 && i > 0 ? { dependsOn: [`batch-${offset}-${i - 1}`] } : {}),
    }));
    const response = await fetch(
      `${runtime.baseUrl}/v1/projects/${project.id}/extensions/commands/pstdio.planner.command.import-tickets/execute`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ params: { tickets } }),
      },
    );
    const value = await response.json();
    if (!response.ok || value.outcome?.ok === false) throw new Error(`Seed ${offset} failed: ${JSON.stringify(value)}`);
  }
  console.log("PROFILE_CASE", JSON.stringify({ ticketCount }));
  browser = await chromium.launch({ headless: true, channel: "chromium" });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...(recording ? { recordVideo: { dir: process.env.PANEL_VIDEO_DIR!, size: { width: 1440, height: 900 } } } : {}),
  });
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
        if (event.data?.diagnostic !== "panel-ticket-painted") return;
        const iframe = [...document.querySelectorAll("iframe")].find((frame) => frame.contentWindow === event.source);
        if (!iframe || iframe.title !== "Project Timeline" || !iframe.getClientRects().length) return;
        window.panelElapsed = event.data.at - (performance.timeOrigin + window.panelStart);
      });
      return;
    }
    let observed = false;
    const observer = new MutationObserver(() => {
      if (observed) return;
      const card = [...document.querySelectorAll("[data-ticket]")].find((node) =>
        node.textContent?.includes("Review the first release"),
      );
      if (!card || !card.getClientRects().length) return;
      observed = true;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (card.isConnected && card.getClientRects().length)
            window.parent.postMessage(
              { diagnostic: "panel-ticket-painted", at: performance.timeOrigin + performance.now() },
              "*",
            );
          else observed = false;
        }),
      );
    });
    observer.observe(document, { childList: true, subtree: true, characterData: true });
  });
  await signInBrowser(page, runtime.descriptor);
  await page.getByRole("option", { name: "Project Timeline", exact: true }).waitFor();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  if (recording)
    await page.evaluate((label) => {
      const marker = document.createElement("div");
      marker.style.cssText =
        "position:fixed;left:0;top:0;width:12px;height:12px;background:#ff00ff;z-index:2147483647;pointer-events:none";
      const caption = document.createElement("div");
      caption.textContent = label;
      caption.style.cssText =
        "position:fixed;right:8px;top:8px;padding:6px 10px;background:#111;color:#fff;z-index:2147483647;font:16px sans-serif;pointer-events:none";
      document.body.append(marker, caption);
    }, process.env.PANEL_VIDEO_LABEL ?? label);
  await page.evaluate(() => {
    window.panelStart = performance.now();
  });
  await page.getByRole("option", { name: "Project Timeline", exact: true }).click();
  await page.waitForFunction(() => window.panelElapsed > 0);
  const elapsed = await page.evaluate(() => Math.round(window.panelElapsed));
  const result = {
    label,
    elapsed,
    recording,
    browserVersion: browser.version(),
    cohort: process.env.PANEL_COHORT,
    workload: process.env.PANEL_CASE,
    ticketCount,
    windowSize: 200,
    pair: process.env.PANEL_PAIR,
    binary,
    revision: process.env.PANEL_REVISION,
    binarySha256: new Bun.CryptoHasher("sha256").update(await Bun.file(binary).arrayBuffer()).digest("hex"),
    at: new Date().toISOString(),
    prebuiltReleaseCount: releases.length,
  };
  console.log("PANEL_RESULT", JSON.stringify(result));
  if (!recording)
    appendFileSync(join(process.env.PANEL_OUTPUT!, "planner-results.jsonl"), `${JSON.stringify(result)}\n`);
  if (recording) await Bun.sleep(1500);
  const video = page.video();
  await context.close();
  if (recording && video) {
    const metadata = {
      label,
      elapsed,
      workload: process.env.PANEL_CASE,
      path: await video.path(),
      revision: process.env.PANEL_REVISION,
    };
    appendFileSync(join(process.env.PANEL_OUTPUT!, "recordings.jsonl"), `${JSON.stringify(metadata)}\n`);
    console.log("PANEL_VIDEO", JSON.stringify(metadata));
  }
} finally {
  await browser?.close();
  if (runtime) await stopProcess(runtime.child);
  rmSync(home, { recursive: true, force: true });
}
