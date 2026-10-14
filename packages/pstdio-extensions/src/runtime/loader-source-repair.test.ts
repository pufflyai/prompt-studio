import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionDiagnostic } from "../types/runtime";
import { extensionLoadKey, loadExtensionPackage } from "./loader";

test("reloads an extension after its missing source module is added", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-source-repair-"));
  const source = join(root, "extension");
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  mkdirSync(source);
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "source-repair",
      publisher: "test",
      version: "1.0.0",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(join(source, "extension.ts"), 'export { default } from "./missing-module";');
  try {
    const failedKey = extensionLoadKey(source);
    const failure: ExtensionDiagnostic[] = [];
    const failed = await loadExtensionPackage({ path: source }, failure);
    expect(failed?.definition.commands).toBeUndefined();
    expect(failure).toContainEqual(expect.objectContaining({ code: "extension_import_failed" }));

    writeFileSync(
      join(source, "missing-module.ts"),
      'export default { commands: [{ id: "check", ref: { kind: "command", id: "check" }, title: "Repaired", run: async () => "repaired-source" }] };',
    );

    // Repairs enter through the loader so a changed source gets a fresh runtime copy.
    const repairedKey = extensionLoadKey(source);
    expect(repairedKey).not.toBe(failedKey);
    const diagnostics: ExtensionDiagnostic[] = [];
    const loaded = await loadExtensionPackage({ path: source }, diagnostics);
    expect(diagnostics).toEqual([]);
    const command = loaded?.definition.commands?.[0];
    expect(command?.id).toBe("check");
    expect(await command!.run({} as never, {})).toBe("repaired-source");

    const repeatedDiagnostics: ExtensionDiagnostic[] = [];
    const repeated = await loadExtensionPackage({ path: source }, repeatedDiagnostics);
    expect(repeatedDiagnostics).toEqual([]);
    expect(extensionLoadKey(source)).toBe(repairedKey);
    expect(await repeated!.definition.commands![0].run({} as never, {})).toBe("repaired-source");
  } finally {
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    rmSync(root, { recursive: true, force: true });
  }
});
