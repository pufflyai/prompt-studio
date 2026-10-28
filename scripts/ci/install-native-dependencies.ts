import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { nativeDependencyEnvironment } from "./native-dependency-environment";

const cwd = realpathSync.native(process.cwd());
console.log(`Install workspace dependencies in ${cwd}`);
const env = nativeDependencyEnvironment(cwd);
if (env.npm_config_nodedir) console.log(`Use configured Node headers at ${env.npm_config_nodedir}`);

// Link the root build tools before isolated workspace dependencies start native builds.
const manifest = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
const tools = spawnSync(process.execPath, ["install", "--frozen-lockfile", "--filter", manifest.name, "--verbose"], {
  env,
  cwd,
  stdio: "inherit",
});
if (tools.error) throw tools.error;
if (tools.status !== 0) process.exit(tools.status ?? 1);
// Bun replaces an existing bin link by deleting and recreating it, while native builds may be running
// through it. Without the old links, the next install creates each root link once and never replaces it.
rmSync(join(cwd, "node_modules", ".bin"), { recursive: true, force: true });

// Keep Node's headers scoped to installation; Electron packaging selects its own runtime headers.
const installed = spawnSync(process.execPath, ["install", "--frozen-lockfile", "--verbose"], {
  cwd,
  env,
  stdio: "inherit",
});
if (installed.error) throw installed.error;
process.exit(installed.status ?? 1);
