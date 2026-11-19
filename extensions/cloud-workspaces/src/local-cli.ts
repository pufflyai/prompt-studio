import { spawn } from "node:child_process";
import { createServer } from "node:net";

export async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "0.0.0.0", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not allocate a listener port.");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
}

export async function runCli(binary: string, directory: string, env: Record<string, string>, args: string[]) {
  // Keep the caller's .env and other instances' settings out of this controller.
  const inherited: Record<string, string> = {};
  for (const name of ["PATH", "HOME", "LANG", "DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_CONFIG"]) {
    const value = process.env[name];
    if (value) inherited[name] = value;
  }
  const child = spawn(binary, ["--env-file", "empty.env", ...args], {
    cwd: directory,
    env: { ...inherited, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 45_000,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (data) => {
    stdout += data;
  });
  child.stderr.on("data", (data) => {
    stderr += data;
  });
  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
  return { exitCode, stdout, stderr };
}
