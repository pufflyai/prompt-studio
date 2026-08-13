import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createRunId, getPlaywrightCommand, sanitizeForwardedArgs } from "./run-playwright";

const getFreePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to resolve free port"));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });

const getDistinctPorts = async () => {
  const apiPort = await getFreePort();
  let devPort = await getFreePort();
  while (devPort === apiPort) devPort = await getFreePort();
  let previewPort = await getFreePort();
  while (previewPort === apiPort || previewPort === devPort) previewPort = await getFreePort();
  return { apiPort, devPort, previewPort };
};

const runDashboardBuild = () =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ["run", "--cwd", "../../packages/pstdio-dashboard", "build"], {
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Dashboard build exited with code ${code ?? "unknown"}`)),
    );
  });

const run = async () => {
  await runDashboardBuild();
  const { apiPort, devPort, previewPort } = await getDistinctPorts();
  const runId = process.env.E2E_RUN_ID ?? createRunId();
  const forwardedArgs = sanitizeForwardedArgs(process.argv.slice(2));
  const command = getPlaywrightCommand(["-c", "playwright.vite-terminal.config.ts", ...forwardedArgs]);
  const child = spawn(command.cmd, command.args, {
    env: {
      ...process.env,
      E2E_API_PORT: String(apiPort),
      E2E_VITE_DEV_PORT: String(devPort),
      E2E_VITE_PREVIEW_PORT: String(previewPort),
      E2E_RUN_ID: runId,
    },
    stdio: "inherit",
  });

  child.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });
  child.on("exit", (code) => process.exit(code ?? 1));
};

if (import.meta.main) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
