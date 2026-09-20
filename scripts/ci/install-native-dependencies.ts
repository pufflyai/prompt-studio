import { spawnSync } from "node:child_process";
import { accessSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";

const cwd = realpathSync.native(process.cwd());
console.log(`Install workspace dependencies in ${cwd}`);
const env: NodeJS.ProcessEnv = {
  ...process.env,
  npm_config_node_gyp: join(cwd, "node_modules", "node-gyp", "bin", "node-gyp.js"),
};
if (process.platform !== "win32") {
  const nodeRoot = dirname(dirname(process.execPath));
  accessSync(join(nodeRoot, "include", "node", "node.h"));
  env.npm_config_nodedir = nodeRoot;
  console.log(`Use the Node headers already installed at ${nodeRoot}`);
}

// Link the root build tools before isolated workspace dependencies start native builds.
const manifest = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
const tools = spawnSync("bun", ["install", "--frozen-lockfile", "--filter", manifest.name, "--verbose"], {
  env,
  cwd,
  stdio: "inherit",
});
if (tools.error) throw tools.error;
if (tools.status !== 0) process.exit(tools.status ?? 1);

// Keep Node's headers scoped to installation; Electron packaging selects its own runtime headers.
const installed = spawnSync("bun", ["install", "--frozen-lockfile", "--verbose"], { cwd, env, stdio: "inherit" });
if (installed.error) throw installed.error;
process.exit(installed.status ?? 1);
