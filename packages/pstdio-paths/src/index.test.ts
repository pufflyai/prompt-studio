import { expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  expandHomePath,
  normalizeEmbeddedFileName,
  resolvePstdioDbPath,
  resolvePstdioHome,
  resolvePstdioLogPath,
  resolvePstdioPerformanceEndpoint,
  resolvePstdioRuntimeDescriptorPath,
  resolvePstdioStatePath,
  resolvePstdioStoragePath,
  resolvePstdioWorkspacesPath,
} from ".";

test("normalizes Windows embedded file names", () => {
  expect(normalizeEmbeddedFileName("..\\..\\pstdio-db\\vendor\\pglite\\pglite.data")).toBe(
    "../../pstdio-db/vendor/pglite/pglite.data",
  );
});

test("resolvePstdioHome uses PSTDIO_HOME when configured", () => {
  expect(
    resolvePstdioHome({ env: { PSTDIO_HOME: resolve("/tmp/pstdio-home") }, homedir: () => resolve("/home/user") }),
  ).toBe(resolve("/tmp/pstdio-home"));
});

test("resolvePstdioHome expands PSTDIO_HOME from the user home", () => {
  expect(resolvePstdioHome({ env: { PSTDIO_HOME: "~/pstdio-dev" }, homedir: () => resolve("/home/user") })).toBe(
    resolve("/home/user/pstdio-dev"),
  );
});

test("resolvePstdioHome defaults to the user home", () => {
  expect(resolvePstdioHome({ env: {}, homedir: () => resolve("/home/user") })).toBe(resolve("/home/user/.pstdio"));
});

test("resolvePstdioHome prefers HOME from env for default paths", () => {
  expect(resolvePstdioHome({ env: { HOME: resolve("/env/home") }, homedir: () => resolve("/system/home") })).toBe(
    resolve("/env/home/.pstdio"),
  );
});

test("default state paths derive from pstdio home", () => {
  const input = { env: { PSTDIO_HOME: resolve("/tmp/pstdio-home") } };

  expect(resolvePstdioDbPath(input)).toBe(resolve("/tmp/pstdio-home/pstdio.db"));
  expect(resolvePstdioLogPath(input)).toBe(resolve("/tmp/pstdio-home/logs.jsonl"));
  expect(resolvePstdioRuntimeDescriptorPath(input)).toBe(resolve("/tmp/pstdio-home/runtime.json"));
  expect(resolvePstdioStatePath(input)).toBe(resolve("/tmp/pstdio-home/state"));
  expect(resolvePstdioStoragePath(input)).toBe(resolve("/tmp/pstdio-home/storage"));
  expect(resolvePstdioWorkspacesPath(input)).toBe(resolve("/tmp/pstdio-home/workspaces"));
});

test("expandHomePath expands tilde paths", () => {
  expect(expandHomePath("~/project", resolve("/home/user"))).toBe(resolve("/home/user/project"));
});

test("the performance endpoint is a socket in the home, or a pipe named after it on Windows", () => {
  const input = { env: { PSTDIO_HOME: resolve("/tmp/pstdio-home") } };

  expect(resolvePstdioPerformanceEndpoint(input, "darwin")).toBe(resolve("/tmp/pstdio-home/performance.sock"));
  const pipe = resolvePstdioPerformanceEndpoint(input, "win32");
  expect(pipe).toMatch(/^\\\\\.\\pipe\\pstdio-performance-[0-9a-f]{16}$/);
  expect(resolvePstdioPerformanceEndpoint({ env: { PSTDIO_HOME: resolve("/tmp/other") } }, "win32")).not.toBe(pipe);
});
