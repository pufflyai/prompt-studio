import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { type Browser, chromium } from "@playwright/test";
import { packExtension, readExtensionPackage } from "pstdio-extensions/distribution";
import { folderProjectInput } from "../helpers/folder-project";
import { runTestCommand } from "../scripts/run-test-command";
import { PACKAGED_DASHBOARD_BROWSER } from "./packaged-chromium";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { runtimeAuthorization, signInBrowser, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();

// A project as `pstdio-canvas` sees it: one canvas file and a preview decorator that records the
// theme UI Canvas sends.
const projectFiles: Record<string, string> = {
  "package.json": `{ "name": "canvas-consumer", "private": true }\n`,
  "src/button.tsx": "export const Button = (props: { label: string }) => <button>{props.label}</button>;\n",
  "src/button.canvas.tsx": `import { Button } from "./button";
export default { title: "Components/Button", component: Button };
export const Primary = { args: { label: "Save" } };
`,
  ".canvas/preview.tsx": `export default {
  decorators: [(Frame: () => unknown, context: { theme: { id: string } }) => <div data-frame-theme={context.theme.id}>{Frame() as never}</div>],
};
`,
};
const writeProject = (repo: string) => {
  for (const [path, content] of Object.entries(projectFiles)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), content);
  }
  mkdirSync(join(repo, "node_modules"));
  for (const name of ["react", "react-dom"])
    symlinkSync(join(import.meta.dirname, "../../node_modules", name), join(repo, "node_modules", name), "dir");
};
const PSTDIO_CANVAS = join(import.meta.dirname, "../../../canvas/bin/pstdio-canvas.ts");

// Critical: an optional install must work outside a source checkout and include its usable skill.
test(
  "installs Canvas from the catalog with working commands and its authoring skill",
  async () => {
    const startedAt = performance.now();
    const phase = (name: string) =>
      console.log(`[Canvas install +${Math.round(performance.now() - startedAt)}ms] ${name}`);
    const root = mkdtempSync(join(tmpdir(), "packaged-canvas-"));
    const packed = await packExtension(join(import.meta.dirname, "../../../../extensions/canvas"));
    const { files } = await readExtensionPackage(packed.bytes);
    // UI Canvas ships no previews; it renders what the project's own build wrote.
    expect([...files.keys()].filter((path) => path.includes("catalog"))).toEqual([]);
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
      phase("runtime ready");
      const repo = join(root, "project");
      mkdirSync(repo);
      writeProject(repo);
      const build = await runTestCommand(process.execPath, [PSTDIO_CANVAS, "build", "--root", repo], {});
      expect(build.status, build.stderr).toBe(0);
      phase("project build ready");
      const headers = { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" };
      const created = await fetch(`${started.baseUrl}/v1/projects`, {
        method: "POST",
        headers,
        body: JSON.stringify(folderProjectInput({ name: "Canvas consumer" }, repo)),
      });
      expect(created.status).toBe(201);
      phase("project created");
      const project = (await created.json()) as { id: string };
      const url = `${started.baseUrl}/v1/projects/${project.id}`;
      const before = await (await fetch(`${url}/extensions`, { headers })).json();
      expect(before.marketplace).toContainEqual(expect.objectContaining({ installName: "canvas", installed: false }));
      const installed = await fetch(`${url}/extensions/install`, {
        method: "POST",
        headers,
        body: JSON.stringify({ source: { kind: "catalog", name: "canvas" } }),
      });
      expect(installed.status, await installed.text()).toBe(201);
      phase("extension installed");
      const after = await (await fetch(`${url}/extensions`, { headers })).json();
      expect(after.extensions).toContainEqual(
        expect.objectContaining({ installName: "canvas", enabled: true, extensionId: "pstdio.canvas" }),
      );
      mkdirSync(join(repo, ".pstdio"), { recursive: true });
      writeFileSync(join(repo, ".pstdio/config.json"), JSON.stringify({ project_id: project.id }));
      const cli = (args: string[]) =>
        runTestCommand(PACKAGED_BINARY_PATH, args, {
          cwd: repo,
          env: {
            ...process.env,
            PSTDIO_HOME: root,
            PSTDIO_API_URL: started.baseUrl,
            PSTDIO_API_TOKEN: started.descriptor.token,
          },
        });
      const list = await cli(["canvas", "list"]);
      expect(list.status).toBe(0);
      const listed = JSON.parse(list.stdout).canvases;
      expect(listed).toContainEqual(expect.objectContaining({ id: "src/button.canvas.tsx", previewCount: 1 }));
      const layout = await cli(["canvas", "layout", "read", "--canvas", "src/button.canvas.tsx"]);
      expect(layout.status).toBe(0);
      expect(JSON.parse(layout.stdout).camera.zoom).toBeGreaterThan(0);
      phase("CLI commands ready");
      // Critical: the installed extension must serve the project's build without a source checkout.
      const assets = await fetch(`${url}/extensions/commands/pstdio.canvas.command.preview.assets/execute`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          source: "api",
          params: { source: "src/button.canvas.tsx", cached: [] },
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
          files: expect.arrayContaining([expect.objectContaining({ path: "SKILL.md" })]),
        }),
      );
      // Critical: the build must also reach an opaque preview through the real webview command bridge.
      const button = listed.find((canvas: { id: string }) => canvas.id === "src/button.canvas.tsx");
      expect(button).toBeDefined();
      phase("assets and skill ready");
      browser = await chromium.launch(PACKAGED_DASHBOARD_BROWSER);
      const page = await browser.newPage();
      await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
      await signInBrowser(page, started.descriptor);
      await page.goto(new URL(button.href, started.baseUrl).href);
      const viewer = page.frameLocator('iframe[title="UI Canvas"]');
      await viewer.locator('iframe[data-frame-ready="true"]').waitFor();
      expect(await viewer.locator("[data-ui-canvas-error]").count()).toBe(0);
      phase("project preview ready");
      await viewer
        .getByRole("button", { name: /^Theme for / })
        .first()
        .click();
      await viewer.getByRole("menuitem", { name: "Prompt Dark", exact: true }).click();
      // The project's decorator receives the frame's theme from UI Canvas.
      const element = await viewer.locator('iframe[data-frame-ready="true"]').first().elementHandle();
      const preview = (await element!.contentFrame())!;
      await preview.waitForSelector('[data-frame-theme="pstdio-dark"]');
      expect(await preview.getByRole("button", { name: "Save" }).count()).toBe(1);
    } finally {
      await browser?.close();
      if (child) await stopProcess(child);
      registry.stop(true);
      rmSync(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
