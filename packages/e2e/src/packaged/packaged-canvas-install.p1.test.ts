import { afterAll, expect, test } from "bun:test";
import { type ChildProcess, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { type Browser, chromium } from "@playwright/test";
import { packExtension, readExtensionPackage } from "pstdio-extensions/distribution";
import { folderProjectInput } from "../helpers/folder-project";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

let catalogRoot: string | undefined;
let packed: Awaited<ReturnType<typeof packExtension>>;
setupPackagedSmokeTests(async () => {
  catalogRoot = mkdtempSync(join(tmpdir(), "canvas-catalog-source-"));
  const source = join(catalogRoot, "canvas");
  cpSync(join(import.meta.dirname, "../../../../extensions/canvas"), source, {
    recursive: true,
    filter: (path) => basename(path) !== "node_modules",
  });
  const manifestPath = join(source, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  // A catalog artifact has a stable version even when this checkout is a nightly snapshot.
  writeFileSync(manifestPath, JSON.stringify({ ...manifest, version: "1.0.0" }));
  packed = await packExtension(source);
});
afterAll(() => {
  if (catalogRoot) rmSync(catalogRoot, { recursive: true, force: true });
});

// Critical: an optional install must work outside a source checkout and include its usable skill.
test(
  "installs Canvas from the catalog with working commands and its authoring skill",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-canvas-"));
    const evidence = join(import.meta.dirname, "../../test-results/canvas-install");
    mkdirSync(evidence, { recursive: true });
    const startedAt = performance.now();
    const stages: { phase: string; elapsedMs: number }[] = [];
    const stage = (phase: string) => {
      stages.push({ phase, elapsedMs: Math.round(performance.now() - startedAt) });
      writeFileSync(join(evidence, "stages.json"), JSON.stringify(stages, null, 2));
    };
    stage("inspect-package");
    const { files } = await readExtensionPackage(packed.bytes);
    expect(files.has("src/catalog/generated/native-manifest.json")).toBe(false);
    for (const asset of ["frame-manifest.json", "frame-themes.json", "stories.json", "source-information.json"]) {
      expect(files.get(`src/catalog/generated/${asset}`)?.size).toBeGreaterThan(0);
    }
    const registry = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        const path = new URL(request.url).pathname;
        if (path === "/api/pstdio/canvas/versions")
          return Response.json({
            versions: [
              {
                id: packed.manifest.id,
                version: packed.manifest.version,
                enginesPstdio: packed.manifest.enginesPstdio,
                sha256: packed.sha256,
                withdrawn: false,
              },
            ],
          });
        if (path === `/api/pstdio/canvas/${packed.manifest.version}/file`) return new Response(packed.bytes);
        return new Response(null, { status: 404 });
      },
    });
    let child: ChildProcess | undefined;
    let browser: Browser | undefined;
    try {
      stage("start-runtime");
      const started = await startPackagedServe(root, {
        PSTDIO_EXTENSION_RELEASE_REF: `psx:${registry.url.origin}`,
        PSTDIO_LOG_PATH: join(evidence, "runtime.jsonl"),
      });
      child = started.child;
      const repo = join(root, "project");
      mkdirSync(repo);
      const headers = { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" };
      stage("create-project");
      const created = await fetch(`${started.baseUrl}/v1/projects`, {
        method: "POST",
        headers,
        body: JSON.stringify(folderProjectInput({ name: "Canvas consumer" }, repo)),
      });
      expect(created.status).toBe(201);
      const project = (await created.json()) as { id: string };
      const url = `${started.baseUrl}/v1/projects/${project.id}`;
      const before = await (await fetch(`${url}/extensions`, { headers })).json();
      expect(before.marketplace).toContainEqual(expect.objectContaining({ installName: "canvas", installed: false }));
      stage("install-catalog-package");
      const installed = await fetch(`${url}/extensions/install`, {
        method: "POST",
        headers,
        body: JSON.stringify({ source: { kind: "catalog", name: "canvas" } }),
      });
      expect(installed.status, await installed.text()).toBe(201);
      stage("check-installed-commands");
      const after = await (await fetch(`${url}/extensions`, { headers })).json();
      expect(after.extensions).toContainEqual(
        expect.objectContaining({ installName: "canvas", enabled: true, extensionId: "pstdio.canvas" }),
      );
      mkdirSync(join(repo, ".pstdio"), { recursive: true });
      writeFileSync(join(repo, ".pstdio/config.json"), JSON.stringify({ project_id: project.id }));
      const cli = (args: string[]) =>
        spawnSync(PACKAGED_BINARY_PATH, args, {
          cwd: repo,
          env: {
            ...process.env,
            PSTDIO_HOME: root,
            PSTDIO_API_URL: started.baseUrl,
            PSTDIO_API_TOKEN: started.descriptor.token,
          },
          encoding: "utf8",
        });
      const list = cli(["canvas", "list"]);
      expect(list.status).toBe(0);
      const listed = JSON.parse(list.stdout).canvases;
      expect(listed).toContainEqual(expect.objectContaining({ id: "shared-components" }));
      const layout = cli(["canvas", "layout", "read", "--canvas", "shared-components"]);
      expect(layout.status).toBe(0);
      expect(JSON.parse(layout.stdout).camera.zoom).toBeGreaterThan(0);
      // Critical: the installed package must supply the selected graph without a source checkout.
      const assets = await fetch(`${url}/extensions/commands/pstdio.canvas.command.preview.assets/execute`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          source: "api",
          params: { source: "packages/ui/src/components/primitives/button.canvas.tsx", cached: [] },
        }),
      });
      expect(assets.status).toBe(200);
      const result = await assets.json();
      expect(result.outcome.ok).toBe(true);
      const { entry, modules, files } = result.outcome.value;
      expect(modules).toContain(entry);
      expect(modules.length).toBeGreaterThan(0);
      for (const name of modules) {
        const code = Bun.gunzipSync(Buffer.from(files[name], "base64"));
        expect(code.byteLength).toBeGreaterThan(0);
      }
      const skills = await (await fetch(`${url}/skills`, { headers })).json();
      expect(skills).toContainEqual(
        expect.objectContaining({
          name: "canvas",
          files: expect.arrayContaining([
            expect.objectContaining({ path: "SKILL.md" }),
            expect.objectContaining({ path: "references/maintaining-canvas.md" }),
          ]),
        }),
      );
      // Critical: packaged assets must also reach an opaque preview through the real webview command bridge.
      const button = listed.find((canvas: { id: string }) => canvas.id === "stories-ui-components-inputs-button");
      expect(button).toBeDefined();
      stage("launch-preview-browser");
      browser = await chromium.launch(PACKAGED_DASHBOARD_BROWSER);
      const page = await browser.newPage();
      await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
      await signInBrowser(page, started.descriptor);
      await page.goto(new URL(button.href, started.baseUrl).href);
      stage("load-preview-frame");
      const viewer = page.frameLocator('iframe[title="UI Canvas"]');
      await viewer.locator('iframe[data-frame-ready="true"]').waitFor();
      expect(await viewer.locator("[data-ui-canvas-error]").count()).toBe(0);
      await viewer
        .getByRole("button", { name: /^Theme for / })
        .first()
        .click();
      await viewer.getByRole("menuitem", { name: "Monokai (VS Code colors)", exact: true }).click();
      const element = await viewer.locator('iframe[data-frame-ready="true"]').first().elementHandle();
      const preview = (await element!.contentFrame())!;
      await preview.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "vscode-monokai");
      const colors = await preview.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        return {
          background: style.getPropertyValue("--chakra-colors-bg"),
          message: style.getPropertyValue("--chakra-colors-bg-subtle"),
        };
      });
      expect(colors.message).not.toBe(colors.background);
      stage("complete");
    } finally {
      await browser?.close();
      if (child) await stopProcess(child);
      registry.stop(true);
      rmSync(root, { recursive: true, force: true });
    }
  },
  // Approved 2026-10-31: cold Windows dependency installation and preview validation share 60 seconds.
  process.platform === "win32" ? 60_000 : PACKAGED_TEST_TIMEOUT,
);
