import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const electronPath = require("electron") as string;
const root = mkdtempSync(join(tmpdir(), "electron-startup-baseline-"));
const measurements: Record<string, unknown>[] = [];

try {
  const sourcePath = join(root, "baseline.ts");
  writeFileSync(
    sourcePath,
    `
    import { app, BrowserWindow } from "electron";
    import { writeFileSync } from "node:fs";
    const moduleLoadedAt = Date.now();
    const output = process.argv.find((arg) => arg.startsWith("--probe-output=")).slice(15);
    app.whenReady().then(() => {
      const appReadyAt = Date.now();
      const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
      window.once("ready-to-show", () => {
        window.show();
        writeFileSync(output, JSON.stringify({ moduleLoadedAt, appReadyAt, windowAt: Date.now(), visible: window.isVisible(), electron: process.versions.electron }));
        app.exit(0);
      });
      window.loadURL("data:text/html,<main>Prompt Studio</main>");
    });
  `,
  );
  const build = await Bun.build({
    entrypoints: [sourcePath],
    outdir: join(root, "dist"),
    target: "node",
    external: ["electron"],
  });
  if (!build.success) throw new Error("Could not build the Electron baseline");
  for (let index = 0; index < 3; index++) {
    const home = join(root, `home-${index}`);
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
      [build.outputs[0]!.path, `--user-data-dir=${join(home, "profile")}`, `--probe-output=${output}`],
      {
        env,
        encoding: "utf8",
        timeout: 10_000,
      },
    );
    if (child.status !== 0) throw new Error(`Electron baseline failed: ${child.stderr}`);
    const timing = JSON.parse(readFileSync(output, "utf8")) as Record<string, number | boolean | string>;
    measurements.push({
      ...timing,
      startedAt,
      processToModuleMs: Number(timing.moduleLoadedAt) - startedAt,
      processToReadyMs: Number(timing.appReadyAt) - startedAt,
      processToWindowMs: Number(timing.windowAt) - startedAt,
    });
  }
  const result = { platform: process.platform, arch: process.arch, measurements };
  await Bun.write(
    resolve(import.meta.dirname, "../test-results/electron-startup-baseline.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
