import { createHash } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionInstallEnvironment } from "pstdio-extensions";
import { inventoryInstalledDependencies } from "./installed-dependency-inventory";
import { preparePlannerSource } from "./packaged-planner-source";

const order = process.env.PS932_BACKEND_ORDER?.split(",");
if (!order || order.length !== 2 || !order.includes("default") || !order.includes("copyfile"))
  throw new Error("A complete diagnostic backend order is required");
const binary = process.env.E2E_PACKAGED_BINARY_PATH;
if (!binary) throw new Error("The normal compiled binary is required");
const root = await mkdtemp(join(tmpdir(), "ps-932-install-backends-"));
const source = await preparePlannerSource(root);
const frozenLock = await Bun.file(join(source, "bun.lock")).text();
const frozenLockHash = createHash("sha256").update(frozenLock).digest("hex");
const summaries: unknown[] = [];

const sampleLinkCounts = (path: string) => {
  const samples: Array<{ path: string; links: number }> = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (samples.length >= 50) return;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) samples.push({ path, links: statSync(path).nlink });
    }
  };
  visit(path);
  return samples;
};

for (const backend of order) {
  const target = join(root, backend, ".extension-install", "pstdio-planner");
  await cp(source, target, { recursive: true });
  const cache = join(root, backend, "cache", "extension-bun-install");
  await mkdir(cache, { recursive: true });
  const stdout = Bun.file(join(root, backend, "installer.stdout.log"));
  const stderr = Bun.file(join(root, backend, "installer.stderr.log"));
  const argv = [
    binary,
    "install",
    "--frozen-lockfile",
    "--ignore-scripts",
    "--production",
    "--verbose",
    ...(backend === "copyfile" ? ["--backend=copyfile"] : []),
  ];
  const env: NodeJS.ProcessEnv = {
    ...createExtensionInstallEnvironment({ ...process.env, HOME: root }),
    BUN_BE_BUN: "1",
    BUN_INSTALL_CACHE_DIR: cache,
  };
  const startedAt = performance.now();
  const child = Bun.spawn(argv, { cwd: target, env, stdin: "ignore", stdout, stderr, windowsHide: true });
  const exitCode = await child.exited;
  const elapsedMs = performance.now() - startedAt;
  const usage = child.resourceUsage();
  const resultLock = await Bun.file(join(target, "bun.lock")).text();
  const summary = {
    backend,
    order,
    binary,
    bun: { version: Bun.version, revision: Bun.revision },
    argv,
    target,
    cache,
    frozenLockHash,
    frozenPackageCount: [...frozenLock.matchAll(/^\s*"([^"]+)": \["([^"]+)",/gm)].length,
    unchangedLock: resultLock === frozenLock,
    elapsedMs,
    exitCode,
    http: env.BUN_CONFIG_MAX_HTTP_REQUESTS,
    workerOverride: env.UV_THREADPOOL_SIZE,
    usage: { cpuTime: usage?.cpuTime, maxRSS: usage?.maxRSS, ops: usage?.ops },
    linkSamples: exitCode === 0 ? sampleLinkCounts(join(target, "node_modules")) : [],
  };
  summaries.push(summary);
  const json = JSON.stringify(summary, (_key, value) => (typeof value === "bigint" ? value.toString() : value), 2);
  await writeFile(join(root, backend, "summary.json"), json);
  console.log(json);
  console.log((await stdout.text()).slice(-1000));
  console.log((await stderr.text()).slice(-1000));
  if (exitCode !== 0 || resultLock !== frozenLock) process.exitCode = 1;
}
const contents = order.map((backend) => ({
  backend,
  ...inventoryInstalledDependencies(join(root, backend, ".extension-install", "pstdio-planner", "node_modules")),
}));
const equalContents = contents[0]?.digest === contents[1]?.digest;
if (!equalContents) process.exitCode = 1;
console.log(JSON.stringify({ contents, equalContents }));
await writeFile(
  join(root, "summary.json"),
  JSON.stringify(
    { installations: summaries, contents, equalContents },
    (_key, value) => (typeof value === "bigint" ? value.toString() : value),
    2,
  ),
);
