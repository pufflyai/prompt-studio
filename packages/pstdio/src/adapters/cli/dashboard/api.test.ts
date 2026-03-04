import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveApiRoot, resolveBundledApiEntry, runApi, shouldAutoStartApi } from "./api";
import { resolveDefaultDbPath, resolveDefaultStoragePath } from "./state-paths";

type SpawnCall = {
  command: string;
  args: string[];
  options: { cwd?: string; stdio: "inherit" | "ignore"; detached?: boolean; env?: NodeJS.ProcessEnv };
};

const createSpawnRecorder = () => {
  const calls: SpawnCall[] = [];
  let unrefCalled = false;

  const spawner = (
    command: string,
    args: readonly string[],
    options: { cwd?: string; stdio: "inherit" | "ignore"; detached?: boolean; env?: NodeJS.ProcessEnv },
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
  const apiRoot = join(root, "packages", "pstdio-api");
  mkdirSync(apiRoot, { recursive: true });
  writeFileSync(join(apiRoot, "package.json"), JSON.stringify({ name: "pstdio-api" }));
  return apiRoot;
};

const withDefaultDataPaths = (env: NodeJS.ProcessEnv) => ({
  ...env,
  PSTDIO_DB_PATH: resolveDefaultDbPath(),
  PSTDIO_STORAGE_PATH: resolveDefaultStoragePath(),
});

test("resolveApiRoot finds pstdio-api workspace above start directory", () => {
  const base = mkdtempSync(join(tmpdir(), "pstdio-api-root-"));
  const apiRoot = writeApiPackage(base);
  const nested = join(base, "packages", "pstdio", "src");
  mkdirSync(nested, { recursive: true });

  expect(resolveApiRoot(nested)).toBe(apiRoot);
});

test("runApi spawns bun start in the api workspace", () => {
  const base = mkdtempSync(join(tmpdir(), "pstdio-api-run-"));
  const apiRoot = writeApiPackage(base);
  const nested = join(base, "packages", "pstdio", "src");
  mkdirSync(nested, { recursive: true });

  const { calls, spawner, unrefCalled } = createSpawnRecorder();
  const env = { PSTDIO_DISABLE_API_AUTO_START: "0" } as NodeJS.ProcessEnv;

  runApi(nested, { spawner, env });

  expect(calls).toEqual([
    {
      command: "bun",
      args: ["run", "start"],
      options: { cwd: apiRoot, stdio: "ignore", detached: true, env: withDefaultDataPaths(env) },
    },
  ]);
  expect(unrefCalled()).toBe(true);
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
      command: "bun",
      args: ["run", "start"],
      options: { cwd: apiRoot, stdio: "inherit", detached: false, env: withDefaultDataPaths(env) },
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
      command: "bun",
      args: ["run", "start"],
      options: { cwd: apiRoot, stdio: "inherit", detached: true, env: withDefaultDataPaths(env) },
    },
  ]);
});

test("runApi forwards PSTDIO_API_PORT as PORT", () => {
  const base = mkdtempSync(join(tmpdir(), "pstdio-api-port-"));
  const apiRoot = writeApiPackage(base);
  const nested = join(base, "packages", "pstdio", "src");
  mkdirSync(nested, { recursive: true });

  const { calls, spawner } = createSpawnRecorder();
  const env = { PSTDIO_DISABLE_API_AUTO_START: "0", PSTDIO_API_PORT: "4511" } as NodeJS.ProcessEnv;

  runApi(nested, { spawner, env });

  expect(calls).toEqual([
    {
      command: "bun",
      args: ["run", "start"],
      options: {
        cwd: apiRoot,
        stdio: "ignore",
        detached: true,
        env: withDefaultDataPaths({ ...env, PORT: "4511" }),
      },
    },
  ]);
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
  expect(unrefCalled()).toBe(true);
});

test("runApi sets default PSTDIO_DB_PATH and PSTDIO_STORAGE_PATH for bundled mode", () => {
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
  expect(spawnedEnv.PSTDIO_DB_PATH).toBe(resolveDefaultDbPath());
  expect(spawnedEnv.PSTDIO_STORAGE_PATH).toBe(resolveDefaultStoragePath());
});

test("runApi sets default PSTDIO_DB_PATH and PSTDIO_STORAGE_PATH for workspace mode", () => {
  const base = mkdtempSync(join(tmpdir(), "pstdio-api-workspace-env-"));
  const apiRoot = writeApiPackage(base);
  const startDir = join(base, "packages", "pstdio", "src");
  mkdirSync(startDir, { recursive: true });

  const { calls, spawner } = createSpawnRecorder();
  const env = { PSTDIO_DISABLE_API_AUTO_START: "0" } as NodeJS.ProcessEnv;

  runApi(startDir, { spawner, env });

  const spawnedEnv = calls[0]?.options.env as Record<string, string>;
  expect(calls[0]?.options.cwd).toBe(apiRoot);
  expect(spawnedEnv.PSTDIO_DB_PATH).toBe(resolveDefaultDbPath());
  expect(spawnedEnv.PSTDIO_STORAGE_PATH).toBe(resolveDefaultStoragePath());
});
