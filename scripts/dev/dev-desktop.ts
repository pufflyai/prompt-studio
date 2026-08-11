import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runDesktopDevelopment } from "./dev-desktop-runner";
import { resolveIsolatedHome } from "./dev-isolated";

const STACK_NAME = "pstdio-desktop";
const repoRoot = resolve(import.meta.dirname, "../..");
const pstdioHome = resolveIsolatedHome(repoRoot, STACK_NAME);

const run = (args: string[]) => {
  const result = spawnSync("bun", args, { cwd: repoRoot, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`Desktop development command failed: bun ${args.join(" ")}`);
};

const stopStack = () => {
  run(["scripts/dev/dev-isolated.ts", "--name", STACK_NAME, "--down"]);
};

const main = async () => {
  run(["run", "--cwd", "clients/desktop", "build"]);
  run(["scripts/dev/dev-isolated.ts", "--name", STACK_NAME, "--desktop"]);

  const connection = JSON.parse(readFileSync(resolve(pstdioHome, "..", "connection.json"), "utf8")) as {
    pstdioHome: string;
  };
  if (connection.pstdioHome !== pstdioHome) throw new Error("Isolated desktop home did not match the requested stack");

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PSTDIO_HOME: pstdioHome,
    PSTDIO_DESKTOP_EXTERNAL_RUNTIME: "1",
  };
  delete env.ELECTRON_RUN_AS_NODE;
  const electron = spawn("bun", ["run", "--cwd", "clients/desktop", "start"], {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  });
  const stopElectron = () => electron.kill("SIGTERM");
  process.once("SIGINT", stopElectron);
  process.once("SIGTERM", stopElectron);

  const code = await new Promise<number>((resolveExit, reject) => {
    electron.once("error", reject);
    electron.once("exit", (exitCode) => resolveExit(exitCode ?? 1));
  });
  process.off("SIGINT", stopElectron);
  process.off("SIGTERM", stopElectron);
  if (code !== 0) throw new Error(`Electron exited with code ${code}`);
};

await runDesktopDevelopment({
  start: main,
  stop: stopStack,
  reportCleanupFailure: (error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Could not stop the isolated desktop stack: ${message}\n`);
  },
});
