import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionDiagnostic } from "../types/runtime";
import { loadExtensionPackage } from "./loader";

test.each([
  "^0.0.9",
  "^999.0.0",
])("keeps incompatible extension identity without executing its code: %s", async (range) => {
  const root = mkdtempSync(join(tmpdir(), "extension-compatibility-"));
  const marker = join(root, "executed");
  const manifest = {
    name: "compatibility",
    publisher: "test",
    version: "1.0.0",
    main: "./extension.ts",
    engines: { pstdio: range },
  };
  writeFileSync(join(root, "package.json"), JSON.stringify(manifest));
  writeFileSync(
    join(root, "extension.ts"),
    `import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(marker)}, "executed");
export default { commands: [{ id: "hello", ref: { kind: "command", id: "hello" }, title: "Hello", run: async () => "hello" }] };`,
  );
  try {
    const diagnostics: ExtensionDiagnostic[] = [];
    const loaded = await loadExtensionPackage({ path: root }, diagnostics);
    expect(existsSync(marker)).toBe(false);
    expect(loaded?.manifest.id).toBe("test.compatibility");
    expect(loaded?.definition).toEqual({});
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "extension_manifest_unsupported_api_version",
        extensionId: "test.compatibility",
        severity: "error",
      }),
    );

    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ ...manifest, engines: { pstdio: `^${EXTENSION_API_VERSION}` } }),
    );
    const recoveredDiagnostics: ExtensionDiagnostic[] = [];
    const recovered = await loadExtensionPackage({ path: root }, recoveredDiagnostics);
    expect(recoveredDiagnostics).toEqual([]);
    expect(existsSync(marker)).toBe(true);
    expect(recovered?.definition.commands?.[0]?.id).toBe("hello");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
