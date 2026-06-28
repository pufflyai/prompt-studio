import { spawn } from "node:child_process";
import { createServer } from "node:net";

export const sanitizeForwardedArgs = (argv: string[]) => argv.filter((arg) => arg !== "--silent");

export const createRunId = ({ now = Date.now(), pid = process.pid }: { now?: number; pid?: number } = {}) =>
  `${now}-${pid}`;

export const buildPlaywrightEnv = (
  env: NodeJS.ProcessEnv,
  ports: { apiPort: number; dashboardPort: number },
  runId: string,
) => {
  const cleanEnv = { ...env };

  delete cleanEnv.PSTDIO_API_PORT;
  delete cleanEnv.PSTDIO_API_URL;
  delete cleanEnv.VITE_API_BASE_URL;

  return {
    ...cleanEnv,
    E2E_API_PORT: String(ports.apiPort),
    E2E_DASHBOARD_PORT: String(ports.dashboardPort),
    E2E_RUN_ID: runId,
  };
};

export const getPlaywrightCommand = (args: string[]) => ({
  cmd: process.execPath,
  args: ["x", "playwright", "test", ...args],
});

const forwardedArgs = sanitizeForwardedArgs(process.argv.slice(2));

const getFreePort = async () =>
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

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });

const getPortPair = async () => {
  const apiPort = await getFreePort();
  let dashboardPort = await getFreePort();

  while (dashboardPort === apiPort) {
    dashboardPort = await getFreePort();
  }

  return { apiPort, dashboardPort };
};

const run = async () => {
  const { apiPort, dashboardPort } = await getPortPair();
  const runId = process.env.E2E_RUN_ID ?? createRunId();
  const command = getPlaywrightCommand(forwardedArgs);

  const child = spawn(command.cmd, command.args, {
    env: buildPlaywrightEnv(process.env, { apiPort, dashboardPort }, runId),
    stdio: "inherit",
  });

  child.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code ?? 1);
  });
};

if (import.meta.main) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
