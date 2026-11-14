// Run with E2E_PACKAGED_BINARY_PATH=<production binary> NOTE_OPEN_LABEL=<unique label>
// bun packages/e2e/src/perf/note-opening.diagnostic.ts
// BENCHMARK_SAMPLES defaults to five fresh browser contexts. Results land under
// __test-tmp__/note-opening/<label>-<run>. Timing covers the click through the correct visible
// editor content plus two animation frames, after the initial project tree has loaded.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { join, resolve } from "node:path";
import { type Browser, chromium, expect, type Page } from "@playwright/test";
import { PROVISIONED_CHROMIUM } from "../packaged/packaged-chromium";
import { preparePackagedExtensionSource } from "../packaged/packaged-extension-source";
import { PACKAGED_BINARY_PATH } from "../packaged/packaged-helpers";
import {
  runtimeAuthorization,
  signInBrowser,
  startPackagedServe,
  stopProcess,
} from "../packaged/packaged-serve-helpers";

const repo = resolve(import.meta.dirname, "../../../..");
const label = process.env.NOTE_OPEN_LABEL ?? "baseline";
const sampleCount = Number(process.env.BENCHMARK_SAMPLES ?? 5);
if (!Number.isSafeInteger(sampleCount) || sampleCount < 1) {
  throw new Error("BENCHMARK_SAMPLES must be a positive integer");
}
const runs = join(repo, "__test-tmp__", "note-opening");
mkdirSync(runs, { recursive: true });
const root = mkdtempSync(join(runs, `${label}-`));
console.log(`Diagnostic output: ${root}`);
const projectPath = join(root, "project");
mkdirSync(projectPath, { recursive: true });
const source = await preparePackagedExtensionSource(join(root, "source"), join(repo, "extensions/pstdio-notes"), {
  install: true,
});
const log = Bun.file(join(root, "runtime.log")).writer();
let started: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
let browser: Browser | undefined;
try {
  started = await startPackagedServe(
    root,
    { PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source, installName: "pstdio-notes" }]) },
    PACKAGED_BINARY_PATH,
    undefined,
    (chunk) => log.write(chunk),
  );
  const runtime = started;
  const headers = { ...runtimeAuthorization(runtime.descriptor), "content-type": "application/json" };
  const request = async (path: string, body?: unknown) => {
    const response = await fetch(`${runtime.baseUrl}/v1${path}`, {
      headers,
      method: body === undefined ? "GET" : "POST",
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
    return response.json();
  };
  const samples: Record<string, unknown>[] = [];
  const errors: string[] = [];
  browser = await chromium.launch(PROVISIONED_CHROMIUM);
  const project = await request("/projects", {
    name: "Note opening diagnostic",
    initial_workspace: { provider_id: "pstdio.root", params: { path: projectPath } },
  });
  await expect
    .poll(async () => {
      const ui = await request(`/projects/${project.id}/extensions/ui`);
      return ui.views?.some((view: { id: string }) => view.id === "pstdio.notes.view.note-editor");
    })
    .toBe(true);
  const bodies: string[] = [];
  for (let i = 0; i < 100; i++) {
    const id = `note-${String(i).padStart(3, "0")}`;
    const folder = join(projectPath, ".pstdio/extension-storage/pstdio.notes/documents", id);
    mkdirSync(folder, { recursive: true });
    const content = `---\ntitle: "Note ${i}"\n---\n\n# Note body ${i}\n\n${"A representative paragraph with **bold text**, a [link](https://example.com), and useful note content.\n\n".repeat(40)}`;
    writeFileSync(join(folder, "content.md"), content);
    bodies.push(content);
  }
  writeFileSync(
    join(projectPath, ".pstdio/extension-storage/pstdio.notes/documents/.order.json"),
    JSON.stringify(Array.from({ length: 100 }, (_, index) => `note-${String(index).padStart(3, "0")}`)),
  );
  const measure = async (page: Page, visit: string, note: number, iteration: number) => {
    const requests: { path: string; method: string; start: number; end?: number }[] = [];
    const pending = new Map<import("@playwright/test").Request, (typeof requests)[number]>();
    const onRequest = (request: import("@playwright/test").Request) => {
      const entry = { path: new URL(request.url()).pathname, method: request.method(), start: performance.now() };
      pending.set(request, entry);
      requests.push(entry);
    };
    const onFinished = (request: import("@playwright/test").Request) => {
      const entry = pending.get(request);
      if (entry) entry.end = performance.now();
    };
    page.on("request", onRequest);
    page.on("requestfinished", onFinished);
    await page.evaluate((body) => {
      const state = window as typeof window & { noteTiming?: { click: number; ready?: number; longTasks: unknown[] } };
      const timing = { click: 0, ready: undefined as number | undefined, longTasks: [] as unknown[] };
      state.noteTiming = timing;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (timing.click && entry.startTime >= timing.click)
            timing.longTasks.push({ start: entry.startTime - timing.click, duration: entry.duration });
      });
      observer.observe({ type: "longtask", buffered: false });
      document.addEventListener(
        "click",
        () => {
          timing.click = performance.now();
          const poll = () => {
            const editor = [...document.querySelectorAll('[contenteditable="true"]')].find(
              (node) => node.textContent?.includes(body) && node.getBoundingClientRect().height > 0,
            );
            if (!editor) return requestAnimationFrame(poll);
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                timing.ready = performance.now() - timing.click;
                observer.disconnect();
              }),
            );
          };
          requestAnimationFrame(poll);
        },
        { once: true, capture: true },
      );
    }, `Note body ${note}`);
    const before = performance.now();
    await page
      .locator('[data-workbench-region="sidenav"]')
      .getByRole("option", { name: `Note ${note}`, exact: true })
      .click();
    await page.waitForFunction(
      () => (window as typeof window & { noteTiming?: { ready?: number } }).noteTiming?.ready !== undefined,
    );
    const timing = await page.evaluate(() => (window as typeof window & { noteTiming?: unknown }).noteTiming);
    page.off("request", onRequest);
    page.off("requestfinished", onFinished);
    const result = {
      iteration,
      visit,
      note,
      timing,
      requests: requests.map((entry) => ({
        ...entry,
        start: entry.start - before,
        end: entry.end && entry.end - before,
      })),
      assets: await page.evaluate(() => {
        const click = (window as typeof window & { noteTiming?: { click: number } }).noteTiming?.click ?? 0;
        return performance
          .getEntriesByType("resource")
          .filter((entry) => entry.startTime >= click)
          .map((entry) => ({
            name: new URL(entry.name).pathname,
            start: entry.startTime - click,
            duration: entry.duration,
          }));
      }),
    };
    samples.push(result);
    console.log(JSON.stringify(result));
  };
  for (let iteration = 0; iteration < sampleCount; iteration++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      if (window === window.top) localStorage.setItem("onboarding-complete", "true");
    });
    await signInBrowser(page, started.descriptor);
    await page.goto(`${started.baseUrl}/projects/${project.id}/extensions/pstdio.notes/notes`);
    await page.locator('[data-workbench-region="sidenav"]').getByRole("option", { name: "Notes", exact: true }).click();
    await expect(page.getByRole("option", { name: "Note 0", exact: true })).toBeVisible();
    await measure(page, "first", 0, iteration);
    await measure(page, "second", 1, iteration);
    await measure(page, "revisit", 0, iteration);
    await context.close();
  }
  await Bun.write(
    join(root, "results.json"),
    JSON.stringify(
      {
        label,
        commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(),
        binary: PACKAGED_BINARY_PATH,
        browser: browser.version(),
        cpu: cpus()[0]?.model,
        workload: { notes: 100, bytesPerNote: Buffer.byteLength(bodies[0]!) },
        samples,
        errors,
      },
      null,
      2,
    ),
  );
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  try {
    await browser?.close();
  } finally {
    try {
      if (started) await stopProcess(started.child);
    } finally {
      await log.end();
    }
  }
}
