import { afterEach, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cleanupRuntimeDescriptor,
  discoverRuntime,
  parseRuntimeDescriptor,
  promoteRuntimeDescriptor,
  type RuntimeDescriptor,
  writeRuntimeDescriptor,
} from "./runtime-descriptor";
import { acquireRuntimeDescriptorLock } from "./runtime-descriptor-lock";

const roots: string[] = [];

const createRoot = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-runtime-descriptor-"));
  roots.push(root);
  return root;
};

const descriptor = (overrides: Partial<RuntimeDescriptor> = {}): RuntimeDescriptor => ({
  schemaVersion: 1,
  protocolVersion: 1,
  pid: 1234,
  instanceId: "runtime-one",
  ownerType: "desktop",
  origin: "http://127.0.0.1:43127",
  token: "secret-token",
  appVersion: "0.25.2",
  startedAt: "2026-08-06T08:00:00.000Z",
  ...overrides,
});

const runDescriptorOperation = async (path: string, operation: "cleanup" | "promote") => {
  const modulePath = join(import.meta.dirname, "runtime-descriptor.ts");
  const source = `
    const { cleanupRuntimeDescriptor, promoteRuntimeDescriptor } = await import(${JSON.stringify(modulePath)});
    const path = process.env.RUNTIME_DESCRIPTOR_PATH;
    const operation = process.env.RUNTIME_DESCRIPTOR_OPERATION;
    process.stdout.write("started\\n");
    const identity = { pid: 1234, instanceId: "runtime-one" };
    const result = operation === "cleanup"
      ? cleanupRuntimeDescriptor(path, identity)
      : promoteRuntimeDescriptor(path, identity);
    process.stdout.write(JSON.stringify(result) + "\\n");
  `;
  const child = spawn(process.execPath, ["-e", source], {
    env: { ...process.env, RUNTIME_DESCRIPTOR_OPERATION: operation, RUNTIME_DESCRIPTOR_PATH: path },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  let markStarted: (() => void) | null = null;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
    if (stdout.includes("started\n")) markStarted?.();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  const exited = new Promise<number | null>((resolve) => child.once("exit", resolve));

  return { child, exited, output: () => ({ stderr, stdout }), started };
};

afterEach(() => {
  for (const root of roots) rmSync(root, { force: true, recursive: true });
  roots.length = 0;
});

describe("parseRuntimeDescriptor", () => {
  test("accepts the versioned descriptor contract", () => {
    expect(parseRuntimeDescriptor(descriptor())).toEqual(descriptor());
  });

  test("rejects non-literal loopback origins", () => {
    expect(parseRuntimeDescriptor(descriptor({ origin: "http://localhost:43127" as never }))).toBeNull();
    expect(parseRuntimeDescriptor(descriptor({ origin: "http://127.0.0.1:0" }))).toBeNull();
    expect(parseRuntimeDescriptor(descriptor({ origin: "https://127.0.0.1:43127" as never }))).toBeNull();
  });
});

describe("runtime descriptor persistence", () => {
  test("atomically writes a current-user-only descriptor", () => {
    const path = join(createRoot(), "nested", "runtime.json");

    writeRuntimeDescriptor(path, descriptor());

    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(descriptor());
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  test("only removes the descriptor still owned by the matching process instance", () => {
    const path = join(createRoot(), "runtime.json");
    writeRuntimeDescriptor(path, descriptor({ instanceId: "replacement" }));

    expect(cleanupRuntimeDescriptor(path, { pid: 1234, instanceId: "old" })).toBe(false);
    expect(parseRuntimeDescriptor(JSON.parse(readFileSync(path, "utf8")))).toEqual(
      descriptor({ instanceId: "replacement" }),
    );
    expect(cleanupRuntimeDescriptor(path, { pid: 1234, instanceId: "replacement" })).toBe(true);
    expect(Bun.file(path).size).toBe(0);
  });

  test("does not remove a replacement published while cleanup waits for ownership", async () => {
    const path = join(createRoot(), "runtime.json");
    writeRuntimeDescriptor(path, descriptor());
    const release = acquireRuntimeDescriptorLock(path);
    const operation = await runDescriptorOperation(path, "cleanup");

    try {
      await operation.started;
      writeFileSync(path, `${JSON.stringify(descriptor({ instanceId: "replacement" }), null, 2)}\n`, "utf8");
    } finally {
      release();
    }

    expect(await operation.exited).toBe(0);
    expect(operation.output()).toEqual({ stderr: "", stdout: "started\nfalse\n" });
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(descriptor({ instanceId: "replacement" }));
  });

  test("does not overwrite a replacement published while promotion waits for ownership", async () => {
    const path = join(createRoot(), "runtime.json");
    writeRuntimeDescriptor(path, descriptor());
    const release = acquireRuntimeDescriptorLock(path);
    const operation = await runDescriptorOperation(path, "promote");

    try {
      await operation.started;
      writeFileSync(path, `${JSON.stringify(descriptor({ instanceId: "replacement" }), null, 2)}\n`, "utf8");
    } finally {
      release();
    }

    expect(await operation.exited).toBe(0);
    expect(operation.output()).toEqual({ stderr: "", stdout: "started\nnull\n" });
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(descriptor({ instanceId: "replacement" }));
  });

  test("promotes only the matching runtime and never demotes persistent ownership", () => {
    const path = join(createRoot(), "runtime.json");
    writeRuntimeDescriptor(path, descriptor());

    expect(promoteRuntimeDescriptor(path, { pid: 1234, instanceId: "runtime-one" })?.ownerType).toBe("persistent");
    expect(promoteRuntimeDescriptor(path, { pid: 1234, instanceId: "runtime-one" })?.ownerType).toBe("persistent");
    expect(JSON.parse(readFileSync(path, "utf8")).ownerType).toBe("persistent");
  });
});

describe("discoverRuntime", () => {
  test("returns an authenticated runtime only when pid and instance readiness match", async () => {
    const path = join(createRoot(), "runtime.json");
    writeRuntimeDescriptor(path, descriptor());

    const result = await discoverRuntime(path, {
      isPidAlive: () => true,
      fetch: async (_url, init) => {
        expect(init?.headers).toEqual({ authorization: "Bearer secret-token" });
        return new Response(
          JSON.stringify({
            ok: true,
            instanceId: "runtime-one",
            ownerType: "desktop",
            protocolVersion: 1,
          }),
        );
      },
    });

    expect(result).toEqual({ state: "healthy", descriptor: descriptor() });
  });

  test("reclaims a descriptor only when both its pid and authenticated readiness are dead", async () => {
    const path = join(createRoot(), "runtime.json");
    writeRuntimeDescriptor(path, descriptor());

    const result = await discoverRuntime(path, {
      isPidAlive: () => false,
      fetch: async () => new Response(null, { status: 503 }),
    });

    expect(result).toEqual({ state: "missing" });
    expect(Bun.file(path).size).toBe(0);
  });

  test("does not reclaim when either ownership signal may still be live", async () => {
    const root = createRoot();
    const livePidPath = join(root, "live-pid.json");
    const liveReadyPath = join(root, "live-ready.json");
    writeRuntimeDescriptor(livePidPath, descriptor());
    writeRuntimeDescriptor(liveReadyPath, descriptor());

    const livePid = await discoverRuntime(livePidPath, {
      isPidAlive: () => true,
      fetch: async () => new Response(null, { status: 503 }),
    });
    const liveReady = await discoverRuntime(liveReadyPath, {
      isPidAlive: () => false,
      fetch: async () =>
        new Response(JSON.stringify({ ok: true, instanceId: "runtime-one", ownerType: "desktop", protocolVersion: 1 })),
    });

    expect(livePid.state).toBe("unsafe");
    expect(liveReady.state).toBe("unsafe");
    expect(Bun.file(livePidPath).size).toBeGreaterThan(0);
    expect(Bun.file(liveReadyPath).size).toBeGreaterThan(0);
  });

  test("treats invalid descriptor contents as unsafe", async () => {
    const path = join(createRoot(), "runtime.json");
    writeFileSync(path, "{}", { mode: 0o644 });
    chmodSync(path, 0o644);

    expect(await discoverRuntime(path)).toEqual({ state: "unsafe", reason: "invalid_descriptor" });
  });
});
