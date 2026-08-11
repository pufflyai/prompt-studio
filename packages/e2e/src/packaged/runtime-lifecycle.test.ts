import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TEST_TIMEOUT } from "../cli/timeouts";
import { buildBinary, PACKAGED_BINARY_PATH } from "./packaged-helpers";

const BUILD_TIMEOUT = 180_000;
const homes: string[] = [];
const children: ChildProcess[] = [];

interface RuntimeDescriptor {
  instanceId: string;
  origin: string;
  ownerType: "desktop" | "persistent";
  pid: number;
  protocolVersion: number;
  token: string;
}

const createRuntimeHome = () => {
  const home = mkdtempSync(join(tmpdir(), "pstdio-packaged-runtime-"));
  homes.push(home);
  return home;
};

const createRuntimeEnv = (home: string) => {
  const env = {
    ...process.env,
    HOME: home,
    PSTDIO_DB_PATH: join(home, "pstdio.db"),
    PSTDIO_DEFAULT_EXTENSIONS: "[]",
    PSTDIO_DISABLE_API_AUTO_START: "0",
    PSTDIO_HOME: home,
    PSTDIO_STORAGE_PATH: join(home, "storage"),
  };
  delete env.PSTDIO_API_PORT;
  delete env.PSTDIO_API_URL;
  return env;
};

const readRuntimeLogs = (home: string) => {
  const logPath = join(home, "logs.jsonl");
  return existsSync(logPath) ? readFileSync(logPath, "utf8") : "No runtime log was written.";
};

const runBinary = (args: string[], cwd: string, env: NodeJS.ProcessEnv) => {
  const result = spawnSync(PACKAGED_BINARY_PATH, args, {
    cwd,
    encoding: "utf8",
    env,
    timeout: TEST_TIMEOUT,
  });

  expect(result.error).toBeUndefined();
  expect(result.status, `${result.stderr}\nRuntime log:\n${readRuntimeLogs(cwd)}`).toBe(0);
  return result;
};

const runBinaryAsync = async (args: string[], cwd: string, env: NodeJS.ProcessEnv) => {
  const child = spawn(PACKAGED_BINARY_PATH, args, { cwd, env, stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer | string) => {
    stderr += chunk.toString();
  });
  const exitCode = await new Promise<number | null>((resolve) => child.once("exit", resolve));
  expect(exitCode, stderr).toBe(0);
};

const readDescriptor = (path: string) => JSON.parse(readFileSync(path, "utf8")) as RuntimeDescriptor;

const waitForDescriptor = async (path: string) => {
  const deadline = Date.now() + TEST_TIMEOUT - 5_000;
  while (Date.now() < deadline) {
    if (existsSync(path)) return readDescriptor(path);
    await Bun.sleep(50);
  }
  throw new Error(`Packaged runtime descriptor was not created. Runtime log:\n${readRuntimeLogs(join(path, ".."))}`);
};

const assertAuthenticatedReady = async (descriptor: RuntimeDescriptor) => {
  const response = await fetch(`${descriptor.origin}/runtime/ready`, {
    headers: { authorization: `Bearer ${descriptor.token}` },
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    instanceId: descriptor.instanceId,
    ownerType: descriptor.ownerType,
    protocolVersion: descriptor.protocolVersion,
  });
};

const stopRuntime = (home: string) => {
  const descriptorPath = join(home, "runtime.json");
  if (!existsSync(descriptorPath)) return;

  const descriptor = readDescriptor(descriptorPath);
  const env = createRuntimeEnv(home);
  spawnSync(PACKAGED_BINARY_PATH, ["close", "--force"], {
    cwd: home,
    env,
    stdio: "ignore",
    timeout: TEST_TIMEOUT,
  });

  if (!existsSync(descriptorPath)) return;
  try {
    process.kill(descriptor.pid, "SIGKILL");
  } catch {
    // The runtime already exited.
  }
};

beforeAll(() => {
  buildBinary();
}, BUILD_TIMEOUT);

afterEach(() => {
  for (const home of homes) stopRuntime(home);
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
  for (const home of homes) rmSync(home, { recursive: true, force: true });
  children.length = 0;
  homes.length = 0;
});

describe("packaged runtime lifecycle", () => {
  test(
    "starts a detached port-zero runtime, reuses it, and closes it cleanly",
    async () => {
      const home = createRuntimeHome();
      const env = createRuntimeEnv(home);
      const descriptorPath = join(home, "runtime.json");

      runBinary(["serve"], home, env);
      const started = await waitForDescriptor(descriptorPath);
      expect(started.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      expect(started.ownerType).toBe("persistent");
      await assertAuthenticatedReady(started);

      runBinary(["serve"], home, env);
      expect(readDescriptor(descriptorPath)).toMatchObject({
        instanceId: started.instanceId,
        ownerType: "persistent",
        pid: started.pid,
      });

      runBinary(["close"], home, env);
      expect(existsSync(descriptorPath)).toBe(false);
    },
    TEST_TIMEOUT,
  );

  test(
    "promotes a desktop runtime without replacing its process identity",
    async () => {
      const home = createRuntimeHome();
      const env = createRuntimeEnv(home);
      const descriptorPath = join(home, "runtime.json");
      const child = spawn(PACKAGED_BINARY_PATH, ["serve", "--foreground", "--owner", "desktop", "--port", "0"], {
        cwd: home,
        env,
        stdio: "ignore",
      });
      children.push(child);
      const exited = new Promise<number | null>((resolve) => child.once("exit", resolve));

      const desktop = await waitForDescriptor(descriptorPath);
      expect(desktop.ownerType).toBe("desktop");
      await assertAuthenticatedReady(desktop);

      runBinary(["serve"], home, env);
      expect(readDescriptor(descriptorPath)).toMatchObject({
        instanceId: desktop.instanceId,
        ownerType: "persistent",
        pid: desktop.pid,
      });

      await runBinaryAsync(["close"], home, env);
      expect(await exited).toBe(0);
      expect(existsSync(descriptorPath)).toBe(false);
    },
    TEST_TIMEOUT,
  );
});
