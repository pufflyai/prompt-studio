import { spawnSync } from "node:child_process";
import { accessSync } from "node:fs";
import { dirname, join } from "node:path";

const env = { ...process.env };
if (process.platform !== "win32") {
  const nodeRoot = dirname(dirname(process.execPath));
  accessSync(join(nodeRoot, "include", "node", "node.h"));
  env.npm_config_nodedir = nodeRoot;
  console.log(`Use the Node headers already installed at ${nodeRoot}`);
}

// Keep Node's headers scoped to installation; Electron packaging selects its own runtime headers.
const installed = spawnSync("bun", ["install", "--frozen-lockfile", "--verbose"], { env, stdio: "inherit" });
if (installed.error) throw installed.error;
process.exit(installed.status ?? 1);
