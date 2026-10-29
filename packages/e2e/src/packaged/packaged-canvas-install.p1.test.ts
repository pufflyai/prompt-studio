import { expect, test } from "bun:test";
import { type ChildProcess, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium } from "@playwright/test";
import { packExtension } from "pstdio-extensions/distribution";
import { folderProjectInput } from "../helpers/folder-project";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();

// Critical: an optional install must work outside a source checkout and include its usable skill.
test(
  "installs Canvas from the catalog with working commands and its authoring skill",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-canvas-"));
    const packed = await packExtension(join(import.meta.dirname, "../../../../extensions/canvas"));
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
      const started = await startPackagedServe(root, { PSTDIO_EXTENSION_RELEASE_REF: `psx:${registry.url.origin}` });
      child = started.child;
      const repo = join(root, "project");
      mkdirSync(repo);
      const headers = { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" };
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
      const installed = await fetch(`${url}/extensions/install`, {
        method: "POST",
        headers,
        body: JSON.stringify({ source: { kind: "catalog", name: "canvas" } }),
      });
      expect(installed.status).toBe(201);
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
      // Critical: a clean optional install must render a real frame from its packaged archive.
      const button = listed.find((canvas: { id: string }) => canvas.id === "stories-ui-components-inputs-button");
      expect(button).toBeDefined();
      browser = await chromium.launch(PACKAGED_DASHBOARD_BROWSER);
      const page = await browser.newPage();
      await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
      await signInBrowser(page, started.descriptor);
      await page.goto(new URL(button.href, started.baseUrl).href);
      const viewer = page.frameLocator('iframe[title="UI Canvas"]');
      await viewer.locator('iframe[data-frame-ready="true"]').waitFor();
      expect(await viewer.locator("[data-ui-canvas-error]").count()).toBe(0);
    } finally {
      await browser?.close();
      if (child) await stopProcess(child);
      registry.stop(true);
      rmSync(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
