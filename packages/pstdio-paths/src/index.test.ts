import { expect, test } from "bun:test";
import {
  expandHomePath,
  normalizeEmbeddedFileName,
  resolvePstdioDbPath,
  resolvePstdioHome,
  resolvePstdioLogPath,
  resolvePstdioRuntimeDescriptorPath,
  resolvePstdioStoragePath,
  resolvePstdioWorkspacesPath,
} from ".";

test("normalizes Windows embedded file names", () => {
  expect(normalizeEmbeddedFileName("..\\..\\pstdio-db\\vendor\\pglite\\pglite.data")).toBe(
    "../../pstdio-db/vendor/pglite/pglite.data",
  );
});

test("resolvePstdioHome uses PSTDIO_HOME when configured", () => {
  expect(resolvePstdioHome({ env: { PSTDIO_HOME: "/tmp/pstdio-home" }, homedir: () => "/home/user" })).toBe(
    "/tmp/pstdio-home",
  );
});

test("resolvePstdioHome expands PSTDIO_HOME from the user home", () => {
  expect(resolvePstdioHome({ env: { PSTDIO_HOME: "~/pstdio-dev" }, homedir: () => "/home/user" })).toBe(
    "/home/user/pstdio-dev",
  );
});

test("resolvePstdioHome defaults to the user home", () => {
  expect(resolvePstdioHome({ env: {}, homedir: () => "/home/user" })).toBe("/home/user/.pstdio");
});

test("resolvePstdioHome prefers HOME from env for default paths", () => {
  expect(resolvePstdioHome({ env: { HOME: "/env/home" }, homedir: () => "/system/home" })).toBe("/env/home/.pstdio");
});

test("default state paths derive from pstdio home", () => {
  const input = { env: { PSTDIO_HOME: "/tmp/pstdio-home" } };

  expect(resolvePstdioDbPath(input)).toBe("/tmp/pstdio-home/pstdio.db");
  expect(resolvePstdioLogPath(input)).toBe("/tmp/pstdio-home/logs.jsonl");
  expect(resolvePstdioRuntimeDescriptorPath(input)).toBe("/tmp/pstdio-home/runtime.json");
  expect(resolvePstdioStoragePath(input)).toBe("/tmp/pstdio-home/storage");
  expect(resolvePstdioWorkspacesPath(input)).toBe("/tmp/pstdio-home/workspaces");
});

test("expandHomePath expands tilde paths", () => {
  expect(expandHomePath("~/project", "/home/user")).toBe("/home/user/project");
});
