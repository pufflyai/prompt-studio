import { spawn } from "node:child_process";
import { once } from "node:events";
import { join } from "node:path";

export interface RemoteSessionBrowserFixture {
  origin: string;
  projectId: string;
  sessionId: string;
  unrelatedId: string;
  workspaceId: string;
  targetId: string;
}

export const startRemoteSessionBrowserFixture = () => {
  const script = join(import.meta.dirname, "../../../pstdio-api/src/test-utils/remote-session-browser.fixture.ts");
  const child = spawn("bun", ["--conditions=source", script], {
    stdio: ["pipe", "pipe", "pipe"],
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PSTDIO_"))),
  });
  let output = "";
  let stdout = "";
  const ready = new Promise<RemoteSessionBrowserFixture>((resolve, reject) => {
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      stdout += chunk.toString();
      const line = stdout.split("\n").find((line) => line.startsWith("REMOTE_SESSION_FIXTURE "));
      if (line) resolve(JSON.parse(line.slice("REMOTE_SESSION_FIXTURE ".length)));
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`Remote fixture exited ${code}: ${output}`)));
  });
  const stop = async () => {
    if (!child.pid) return output;
    if (child.exitCode !== null || child.signalCode !== null) {
      if (child.exitCode !== 0)
        throw new Error(`Remote fixture stopped unexpectedly: ${child.exitCode ?? child.signalCode}: ${output}`);
      return output;
    }
    const exited = once(child, "close");
    child.stdin.end("shutdown\n");
    const [code, signal] = await exited;
    if (code !== 0) throw new Error(`Remote fixture cleanup failed: ${code ?? signal}: ${output}`);
    return output;
  };
  return { ready, stop, output: () => output };
};
