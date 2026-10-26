import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionInstallEnvironment } from "pstdio-extensions";
import { preparePlannerSource } from "./packaged-planner-source";

const root = await mkdtemp(join(tmpdir(), "ps-932-planner-installer-"));
const source = await preparePlannerSource(root);
const target = join(root, ".extension-install", "pstdio-planner");
await cp(source, target, { recursive: true });
const cache = join(root, "cache", "extension-bun-install");
await mkdir(cache, { recursive: true });
const stdout = Bun.file(join(root, "installer.stdout.log"));
const stderr = Bun.file(join(root, "installer.stderr.log"));
const binary = process.env.PS932_INSTALL_BINARY ?? process.env.E2E_PACKAGED_BINARY_PATH;
if (!binary) throw new Error("Installer binary path is required");
const argv = [binary, "install", "--frozen-lockfile", "--ignore-scripts", "--production", "--verbose"];
const env: NodeJS.ProcessEnv = {
  ...createExtensionInstallEnvironment({ ...process.env, HOME: root }),
  BUN_BE_BUN: "1",
  BUN_INSTALL_CACHE_DIR: cache,
};
if (process.env.PS932_INSTALL_THREADS) env.UV_THREADPOOL_SIZE = process.env.PS932_INSTALL_THREADS;
const startedAt = performance.now();
const child = Bun.spawn(argv, {
  cwd: target,
  env,
  stdin: "ignore",
  stdout,
  stderr,
  windowsHide: true,
});
const exitCode = await child.exited;
const usage = child.resourceUsage();
const summary = JSON.stringify(
  {
    root,
    argv,
    cwd: target,
    http: env.BUN_CONFIG_MAX_HTTP_REQUESTS,
    workerOverride: env.UV_THREADPOOL_SIZE,
    goMaxProcs: env.GOMAXPROCS,
    elapsedMs: performance.now() - startedAt,
    exitCode,
    usage: { cpuTime: usage?.cpuTime, maxRSS: usage?.maxRSS, ops: usage?.ops },
  },
  (_key, value) => (typeof value === "bigint" ? value.toString() : value),
  2,
);
await writeFile(join(root, "summary.json"), summary);
console.log(summary);
console.log((await stdout.text()).slice(-2000));
console.log((await stderr.text()).slice(-2000));
process.exitCode = exitCode;
