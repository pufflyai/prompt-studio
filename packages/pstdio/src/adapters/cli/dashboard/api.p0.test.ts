import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCompiledApiCommand, resolveApiRoot, resolveBundledApiEntry, runApi, shouldAutoStartApi } from "./api";

type SpawnCall = {
  command: string;
  args: string[];
  options: {
    cwd?: string;
    stdio: "inherit" | "ignore";
    detached?: boolean;
    env?: NodeJS.ProcessEnv;
    windowsHide?: boolean;
  };
};

const createSpawnRecorder = () => {
  const calls: SpawnCall[] = [];
  let unrefCalled = false;

  const spawner = (
    command: string,
    args: readonly string[],
    options: {
      cwd?: string;
      stdio: "inherit" | "ignore";
      detached?: boolean;
      env?: NodeJS.ProcessEnv;
      windowsHide?: boolean;
    },
  ) => {
    calls.push({ command, args: [...args], options });
    const child = {
      unref: () => {
        unrefCalled = true;
      },
      on: (_event: string, _listener: (code: number | null) => void) => child,
    };
    return child;
  };

  return { calls, spawner, unrefCalled: () => unrefCalled };
};

const writeApiPackage = (root: string) => {
  const apiRoot = join(root, "packages", "pstdio");
  mkdirSync(apiRoot, { recursive: true });
  writeFileSync(join(apiRoot, "package.json"), JSON.stringify({ name: "pstdio" }));
  return apiRoot;
};

const runtimeArgs = (port = "0") => [
  "--conditions=source",
  "./src/index.ts",
  "serve",
  "--foreground",
  "--owner",
  "persistent",
  "--host",
  "127.0.0.1",
  "--port",
  port,
];

const withApiRuntimeEnv = (env: NodeJS.ProcessEnv) => ({
  ...env,
});

test("resolveApiRoot finds the pstdio runtime workspace above start directory", () => {
  const base = mkdtempSync(join(tmpdir(), "pstdio-api-root-"));
  const apiRoot = writeApiPackage(base);
  const nested = join(base, "packages", "pstdio", "src");
  mkdirSync(nested, { recursive: true });

  expect(resolveApiRoot(nested)).toBe(apiRoot);
});

test("runApi spawns the combined runtime in the pstdio workspace", () => {
  const base = mkdtempSync(join(tmpdir(), "pstdio-api-run-"));
  const apiRoot = writeApiPackage(base);
  const nested = join(base, "packages", "pstdio", "src");
  mkdirSync(nested, { recursive: true });

  const { calls, spawner, unrefCalled } = createSpawnRecorder();
  const env = { PSTDIO_DISABLE_API_AUTO_START: "0" } as NodeJS.ProcessEnv;

  runApi(nested, { spawner, env });

  expect(calls).toEqual([
    {
      command: process.execPath,
      args: runtimeArgs(),
      options: { cwd: apiRoot, stdio: "ignore", detached: true, env: withApiRuntimeEnv(env), windowsHide: true },
    },
  ]);
  expect(unrefCalled()).toBe(true);
});

test("runApi finds the runtime workspace relative to the source CLI entry when cwd is outside the repo", () => {
  const base = mkdtempSync(join(tmpdir(), "pstdio-api-run-cli-entry-"));
  const outsideBase = mkdtempSync(join(tmpdir(), "pstdio-api-run-cli-entry-outside-"));
  const apiRoot = writeApiPackage(base);
  const cliEntry = join(base, "packages", "pstdio", "src", "index.ts");
  const startDir = join(outsideBase, "cwd");
  mkdirSync(join(base, "packages", "pstdio", "src"), { recursive: true });
  mkdirSync(startDir, { recursive: true });
  writeFileSync(cliEntry, "// cli entry");

  const { calls, spawner } = createSpawnRecorder();
  const env = { PSTDIO_DISABLE_API_AUTO_START: "0" } as NodeJS.ProcessEnv;

  runApi(startDir, { spawner, env, bundledCliPath: cliEntry });

  expect(calls).toEqual([
    {
      command: process.execPath,
      args: runtimeArgs(),
      options: { cwd: apiRoot, stdio: "ignore", detached: true, env: withApiRuntimeEnv(env), windowsHide: true },
    },
  ]);
});

test("runApi keeps child attached when detached is false", () => {
  const base = mkdtempSync(join(tmpdir(), "pstdio-api-attached-"));
  const apiRoot = writeApiPackage(base);
  const nested = join(base, "packages", "pstdio", "src");
  mkdirSync(nested, { recursive: true });

  const { calls, spawner, unrefCalled } = createSpawnRecorder();
  const env = { PSTDIO_DISABLE_API_AUTO_START: "0" } as NodeJS.ProcessEnv;

  runApi(nested, { spawner, env, stdio: "inherit", detached: false });

  expect(calls).toEqual([
    {
      command: process.execPath,
      args: runtimeArgs(),
      options: { cwd: apiRoot, stdio: "inherit", detached: false, env: withApiRuntimeEnv(env), windowsHide: true },
    },
  ]);
  expect(unrefCalled()).toBe(false);
});

test("runApi uses stdio override when provided", () => {
  const base = mkdtempSync(join(tmpdir(), "pstdio-api-stdio-"));
  const apiRoot = writeApiPackage(base);
  const nested = join(base, "packages", "pstdio", "src");
  mkdirSync(nested, { recursive: true });

  const { calls, spawner } = createSpawnRecorder();
  const env = { PSTDIO_DISABLE_API_AUTO_START: "0" } as NodeJS.ProcessEnv;

  runApi(nested, { spawner, env, stdio: "inherit" });

  expect(calls).toEqual([
    {
      command: process.execPath,
      args: runtimeArgs(),
      options: { cwd: apiRoot, stdio: "inherit", detached: true, env: withApiRuntimeEnv(env), windowsHide: true },
    },
  ]);
});

test("runApi forwards PSTDIO_API_PORT to the runtime serve command", () => {
  const base = mkdtempSync(join(tmpdir(), "pstdio-api-port-"));
  const apiRoot = writeApiPackage(base);
  const nested = join(base, "packages", "pstdio", "src");
  mkdirSync(nested, { recursive: true });

  const { calls, spawner } = createSpawnRecorder();
  const env = { PSTDIO_DISABLE_API_AUTO_START: "0", PSTDIO_API_PORT: "4511" } as NodeJS.ProcessEnv;

  runApi(nested, { spawner, env });

  expect(calls).toEqual([
    {
      command: process.execPath,
      args: runtimeArgs("4511"),
      options: {
        cwd: apiRoot,
        stdio: "ignore",
        detached: true,
        env: withApiRuntimeEnv(env),
        windowsHide: true,
      },
    },
  ]);
});

test("compiled auto-start passes the configured port to the serve command", () => {
  expect(buildCompiledApiCommand("4511")).toEqual({
    command: process.execPath,
    args: runtimeArgs("4511").slice(2),
    options: { cwd: undefined, stdio: "ignore", detached: true, windowsHide: true },
  });
});

test("shouldAutoStartApi returns false when disable flag is set", () => {
  expect(shouldAutoStartApi({ PSTDIO_DISABLE_API_AUTO_START: "1" })).toBe(false);
});

test("resolveBundledApiEntry finds bundled api server.js next to CLI dist", () => {
  const base = mkdtempSync(join(tmpdir(), "pstdio-api-bundled-"));
  const cliDistDir = join(base, "dist");
  const apiDir = join(cliDistDir, "api");
  mkdirSync(apiDir, { recursive: true });
  writeFileSync(join(apiDir, "server.js"), "// bundled api");

  const result = resolveBundledApiEntry(join(cliDistDir, "index.js"));

  expect(result).toBe(join(apiDir, "server.js"));
});

test("resolveBundledApiEntry returns null when no bundled api", () => {
  const base = mkdtempSync(join(tmpdir(), "pstdio-api-bundled-none-"));
  const cliDistDir = join(base, "dist");
  mkdirSync(cliDistDir, { recursive: true });

  const result = resolveBundledApiEntry(join(cliDistDir, "index.js"));

  expect(result).toBeNull();
});

test("runApi falls back to bundled api when no workspace found", () => {
  const base = mkdtempSync(join(tmpdir(), "pstdio-api-bundled-run-"));
  const startDir = join(base, "some-project");
  mkdirSync(startDir, { recursive: true });

  const cliDistDir = join(base, "dist");
  const apiDir = join(cliDistDir, "api");
  mkdirSync(apiDir, { recursive: true });
  writeFileSync(join(apiDir, "server.js"), "// bundled api");

  const { calls, spawner, unrefCalled } = createSpawnRecorder();
  const env = { PSTDIO_DISABLE_API_AUTO_START: "0" } as NodeJS.ProcessEnv;

  runApi(startDir, { spawner, env, bundledCliPath: join(cliDistDir, "index.js") });

  expect(calls).toHaveLength(1);
  expect(calls[0]!.command).toBe("node");
  expect(calls[0]!.args).toEqual([join(apiDir, "server.js")]);
  expect(calls[0]!.options.cwd).toBeUndefined();
  expect(calls[0]!.options.stdio).toBe("ignore");
  expect(calls[0]!.options.detached).toBe(true);
  expect(calls[0]!.options.windowsHide).toBe(true);
  expect(unrefCalled()).toBe(true);
});

test("runApi leaves state path defaults to the API for bundled mode", () => {
  const base = mkdtempSync(join(tmpdir(), "pstdio-api-bundled-env-"));
  const startDir = join(base, "some-project");
  mkdirSync(startDir, { recursive: true });

  const cliDistDir = join(base, "dist");
  const apiDir = join(cliDistDir, "api");
  mkdirSync(apiDir, { recursive: true });
  writeFileSync(join(apiDir, "server.js"), "// bundled api");

  const { calls, spawner } = createSpawnRecorder();
  const env = { PSTDIO_DISABLE_API_AUTO_START: "0" } as NodeJS.ProcessEnv;

  runApi(startDir, { spawner, env, bundledCliPath: join(cliDistDir, "index.js") });

  const spawnedEnv = calls[0]?.options.env as Record<string, string>;
  expect(spawnedEnv.PSTDIO_DB_PATH).toBeUndefined();
  expect(spawnedEnv.PSTDIO_STORAGE_PATH).toBeUndefined();
});

test("runApi leaves state path defaults to the API for workspace mode", () => {
  const base = mkdtempSync(join(tmpdir(), "pstdio-api-workspace-env-"));
  const apiRoot = writeApiPackage(base);
  const startDir = join(base, "packages", "pstdio", "src");
  mkdirSync(startDir, { recursive: true });

  const { calls, spawner } = createSpawnRecorder();
  const env = { PSTDIO_DISABLE_API_AUTO_START: "0" } as NodeJS.ProcessEnv;

  runApi(startDir, { spawner, env });

  const spawnedEnv = calls[0]?.options.env as Record<string, string>;
  expect(calls[0]?.options.cwd).toBe(apiRoot);
  expect(spawnedEnv.PSTDIO_DB_PATH).toBeUndefined();
  expect(spawnedEnv.PSTDIO_STORAGE_PATH).toBeUndefined();
  expect(spawnedEnv.PSTDIO_FILES_ROOT).toBeUndefined();
});
