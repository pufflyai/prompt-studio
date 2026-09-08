import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { cpus, tmpdir } from "node:os";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const electronPath = process.env.PSTDIO_PROBE_ELECTRON ?? require("electron");
const root = mkdtempSync(join(tmpdir(), "pstdio-startup-formats-"));
const results: Record<string, unknown>[] = [];

try {
  const sourcePath = join(root, "probe.ts");
  await Bun.write(
    sourcePath,
    `
    import { app, BrowserWindow } from "electron";
    import { writeFileSync } from "node:fs";
    const timings = { moduleLoadedAt: Date.now() };
    const output = process.argv.find((arg) => arg.startsWith("--probe-output=")).slice(15);
    app.whenReady().then(() => {
      timings.appReadyAt = Date.now();
      const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
      timings.windowCreatedAt = Date.now();
      window.webContents.once("did-finish-load", () => { timings.documentLoadedAt = Date.now(); });
      window.once("ready-to-show", async () => {
        window.show();
        timings.windowShownAt = Date.now();
        const paint = await window.webContents.executeJavaScript(
          'new Promise(resolve => { const observer = new PerformanceObserver(list => { const paint = list.getEntries().find(entry => entry.name === "first-contentful-paint"); if (paint) { observer.disconnect(); resolve(performance.timeOrigin + paint.startTime); } }); observer.observe({ type: "paint", buffered: true }); })'
        );
        writeFileSync(output, JSON.stringify({ ...timings, firstContentAt: paint, visible: window.isVisible(), gpu: app.getGPUFeatureStatus() }));
        app.exit(0);
      });
      window.loadURL("data:text/html,<main>Prompt Studio</main>");
    });
  `,
  );
  const entrypoints: Record<string, string> = {};
  for (const format of ["esm", "cjs"] as const) {
    const build = await Bun.build({
      entrypoints: [sourcePath],
      outdir: join(root, format),
      target: "node",
      format,
      naming: format === "esm" ? "[name].mjs" : "[name].cjs",
      external: ["electron"],
    });
    if (!build.success) throw new Error(`Could not build ${format} probe`);
    entrypoints[format] = build.outputs[0]!.path;
  }
  for (const format of ["esm", "cjs", "cjs", "esm", "esm", "cjs"]) {
    const home = join(root, `home-${results.length}`);
    mkdirSync(home);
    const output = join(home, "timings.json");
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      APPDATA: join(home, "app-data"),
      XDG_CONFIG_HOME: join(home, "config"),
    };
    delete env.ELECTRON_RUN_AS_NODE;
    const startedAt = Date.now();
    const child = spawnSync(
      electronPath,
      [entrypoints[format]!, `--user-data-dir=${join(home, "profile")}`, `--probe-output=${output}`],
      { env, encoding: "utf8", timeout: 10_000 },
    );
    if (child.status !== 0) throw new Error(`Probe failed: ${child.stderr}`);
    const timings = JSON.parse(readFileSync(output, "utf8"));
    const relative = Object.fromEntries(
      Object.entries(timings)
        .filter(([key]) => key.endsWith("At"))
        .map(([key, value]) => [key, Number(value) - startedAt]),
    );
    results.push({ format, startedAt, ...relative, visible: timings.visible, gpu: timings.gpu });
    console.log(JSON.stringify(results.at(-1)));
  }
  const output =
    process.env.PSTDIO_PROBE_OUTPUT ?? resolve(import.meta.dirname, "../test-results/startup-formats.json");
  await Bun.write(
    output,
    `${JSON.stringify(
      {
        platform: process.platform,
        arch: process.arch,
        cpus: cpus().map(({ model, speed }) => ({ model, speed })),
        results,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
