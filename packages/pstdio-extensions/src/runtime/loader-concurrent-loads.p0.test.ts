import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionDiagnostic } from "../types/runtime";
import { loadExtensionPackage } from "./loader";

let extensionDir: string;
let homeDir: string | undefined;
let previousPstdioHome: string | undefined;

beforeAll(() => {
  extensionDir = mkdtempSync(join(tmpdir(), "pstdio-loader-concurrent-"));
  writeFileSync(
    join(extensionDir, "package.json"),
    JSON.stringify({
      name: "loader-concurrent-test",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(
    join(extensionDir, "extension.ts"),
    'export default { commands: [{ id: "check", ref: { kind: "command", id: "check" }, title: "loaded", run: async () => "loaded" }] };',
  );
});

afterAll(() => {
  if (extensionDir) rmSync(extensionDir, { recursive: true, force: true });
});

afterEach(() => {
  if (previousPstdioHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousPstdioHome;
  if (homeDir) rmSync(homeDir, { recursive: true, force: true });
  homeDir = undefined;
});

const coldCacheRounds = Array.from({ length: 25 }, (_, index) => index + 1);

// Each cold-cache round has its own deadline, so setup time across rounds cannot fail a healthy load.
test.each(
  coldCacheRounds,
)("concurrent loads of one extension on an empty cache all get its default export (round %i)", async () => {
  previousPstdioHome = process.env.PSTDIO_HOME;
  homeDir = mkdtempSync(join(tmpdir(), "pstdio-loader-concurrent-"));
  process.env.PSTDIO_HOME = join(homeDir, "pstdio-home");
  const diagnostics: ExtensionDiagnostic[] = [];

  // Start each load one event-loop turn after the previous one, so later loads look for the
  // bundle while the first build is still writing it.
  const pending: Array<ReturnType<typeof loadExtensionPackage>> = [];
  for (let load = 0; load < 4; load++) {
    pending.push(loadExtensionPackage({ path: extensionDir }, diagnostics));
    await new Promise((resolve) => setImmediate(resolve));
  }
  const loads = await Promise.all(pending);

  expect(diagnostics).toEqual([]);
  for (const loaded of loads) {
    expect(loaded?.definition.commands).toContainEqual(expect.objectContaining({ id: "check", title: "loaded" }));
  }
});
