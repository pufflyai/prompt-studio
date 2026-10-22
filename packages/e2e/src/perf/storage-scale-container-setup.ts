import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { arch } from "node:os";
import { join, resolve } from "node:path";
import { enterMeasurementWindow } from "./storage-scale-window";

// Preparation only. The regular dev:isolated harness owns ports, mounts and cleanup.
const [name, ownerFile] = process.argv.slice(2);
if (!name || !ownerFile || !/^[a-z0-9-]+$/.test(name))
  throw new Error("Pass <isolated-stack-name> <timing-owner.json>");
const finish = enterMeasurementWindow(ownerFile, (row) => console.log(JSON.stringify(row)));
const repo = resolve(import.meta.dirname, "../../../..");
const root = join(repo, "__test-tmp__", "storage-scale", name);
mkdirSync(root, { recursive: true });
try {
  const binary = join(root, "pstdio-linux");
  execFileSync(
    "bun",
    [
      "build",
      "packages/pstdio/src/index.ts",
      "--compile",
      `--target=bun-linux-${arch()}`,
      "--asset-naming",
      "[dir]/[name].[ext]",
      "--external",
      "playwright-core",
      "--external",
      "chromium-bidi/*",
      "--outfile",
      binary,
    ],
    { cwd: repo, stdio: "inherit" },
  );
  const compose = join(root, "compose.json");
  writeFileSync(
    compose,
    JSON.stringify({
      services: {
        "prompt-studio": {
          environment: {
            // Compose expands this from the ports reserved by dev:isolated.
            CONTAINER_API_PORT: "$" + "{CONTAINER_API_PORT}",
            PSTDIO_SCALE_LINUX_BINARY: binary,
            PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1",
          },
          command: ["bun", join(import.meta.dirname, "storage-scale-container-entry.ts")],
        },
      },
    }),
  );
  execFileSync("bun", ["run", "dev:isolated", "--", "--name", name, "--desktop"], {
    cwd: repo,
    stdio: "inherit",
    env: { ...process.env, PSTDIO_DEFAULT_EXTENSIONS: "[]", PSTDIO_ISOLATED_COMPOSE_FILE: compose },
  });
  const connection = JSON.parse(
    readFileSync(join(repo, "__test-tmp__", "dev-isolated", name, "connection.json"), "utf8"),
  );
  const containerId = execFileSync(
    "docker",
    [
      "ps",
      "--filter",
      `label=com.docker.compose.project=${name}`,
      "--filter",
      "label=com.docker.compose.service=prompt-studio",
      "--format",
      "{{.ID}}",
    ],
    { encoding: "utf8" },
  ).trim();
  if (!containerId || containerId.includes("\n")) throw new Error("Expected one isolated runtime container");
  const path = join(root, "runtime.json");
  writeFileSync(
    path,
    JSON.stringify({ containerId, home: connection.pstdioHome, baseUrl: `http://127.0.0.1:${connection.apiPort}` }),
  );
  console.log(`Container configuration: ${path}`);
} finally {
  finish();
}
