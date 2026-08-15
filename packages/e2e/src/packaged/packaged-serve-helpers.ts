import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";

export type RuntimeDescriptor = {
  pid: number;
  instanceId: string;
  ownerType: "desktop" | "persistent";
  origin: string;
  token: string;
  protocolVersion: number;
};

export const runtimeAuthorization = (descriptor: RuntimeDescriptor) => ({
  authorization: `Bearer ${descriptor.token}`,
});

const waitForReady = async (descriptorPath: string, child: ChildProcess, timeoutMs = 10_000) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1_000);

    try {
      if (!existsSync(descriptorPath)) throw new Error("descriptor not published");
      const descriptor = JSON.parse(readFileSync(descriptorPath, "utf8")) as RuntimeDescriptor;
      const res = await fetch(`${descriptor.origin}/runtime/ready`, {
        headers: { authorization: `Bearer ${descriptor.token}` },
        signal: controller.signal,
      });
      const ready = res.ok ? ((await res.json()) as { instanceId: string; protocolVersion: number }) : null;
      if (
        descriptor.pid === child.pid &&
        descriptor.ownerType === "persistent" &&
        descriptor.origin.startsWith("http://127.0.0.1:") &&
        ready?.instanceId === descriptor.instanceId &&
        ready.protocolVersion === descriptor.protocolVersion
      ) {
        return descriptor;
      }
    } catch {
      // The server is not ready yet.
    } finally {
      clearTimeout(timeout);
    }

    await Bun.sleep(200);
  }

  throw new Error(`Packaged runtime did not become ready within ${timeoutMs}ms`);
};

export const startPackagedServe = async (tempRoot: string, env: Record<string, string> = {}) => {
  const descriptorPath = join(tempRoot, "runtime.json");
  const child = spawn(
    PACKAGED_BINARY_PATH,
    ["serve", "--foreground", "--owner", "persistent", "--host", "127.0.0.1", "--port", "0"],
    {
      // Run outside the repo root so runtime file access cannot rely on local workspace paths.
      cwd: tempRoot,
      env: {
        ...process.env,
        HOME: tempRoot,
        PSTDIO_HOME: tempRoot,
        PSTDIO_DB_PATH: join(tempRoot, "db.sqlite"),
        PSTDIO_DEFAULT_EXTENSIONS: "[]",
        PSTDIO_STORAGE_PATH: join(tempRoot, "storage"),
        ...env,
      },
      stdio: "pipe",
    },
  );

  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer | string) => {
    stderr += chunk.toString();
  });

  try {
    const descriptor = await waitForReady(descriptorPath, child);
    return { child, baseUrl: descriptor.origin, descriptor };
  } catch (error) {
    await stopProcess(child);
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${stderr}`.trim());
  }
};

export const stopProcess = async (child: ChildProcess) => {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }
};
