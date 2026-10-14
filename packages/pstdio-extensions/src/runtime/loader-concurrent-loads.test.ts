import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionDiagnostic } from "../types/runtime";
import { loadExtensionPackage } from "./loader";

const tempDirs: string[] = [];
let previousPstdioHome: string | undefined;

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-loader-concurrent-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  if (previousPstdioHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousPstdioHome;

  previousPstdioHome = undefined;
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

test("concurrent loads of one extension on an empty cache all get its default export", async () => {
  previousPstdioHome = process.env.PSTDIO_HOME;
  const extensionDir = createTempDir();
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

  // First project setup loads one extension from several places at once. Each round starts
  // with a new home folder, so every round bundles into an empty cache.
  for (let round = 0; round < 25; round++) {
    process.env.PSTDIO_HOME = join(createTempDir(), "pstdio-home");
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
  }
});
