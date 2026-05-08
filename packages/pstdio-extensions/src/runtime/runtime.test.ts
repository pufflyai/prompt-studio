import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadExtensionRuntime } from "./runtime";

const tempDirs: string[] = [];

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-ext-runtime-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

describe("loadExtensionRuntime", () => {
  test("loads extensions from a custom root and normalizes their commands", async () => {
    const root = createTempDir();
    mkdirSync(join(root, "lab"));
    writeFileSync(
      join(root, "lab", "extension.ts"),
      `export default {
        id: "pstdio.extension-lab",
        namespace: "lab",
        name: "Lab",
        commands: {
          "say-hello": {
            title: "Say hello",
            cli: true,
            run: async () => ({ message: "hi" }),
          },
        },
      };`,
    );

    const runtime = await loadExtensionRuntime({
      includeUserRoot: false,
      extensionRoots: [{ path: root }],
    });

    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.extensions).toHaveLength(1);
    expect(runtime.commands).toHaveLength(1);
    expect(runtime.commands[0]?.id).toBe("lab.say-hello");
    expect(runtime.cli[0]?.pathKey).toBe("lab say-hello");
  });

  test("reports diagnostics when an extension has invalid identity", async () => {
    const root = createTempDir();
    mkdirSync(join(root, "bad"));
    writeFileSync(join(root, "bad", "extension.ts"), `export default { id: "Bad Id", namespace: "bad", name: "Bad" };`);

    const runtime = await loadExtensionRuntime({
      includeUserRoot: false,
      extensionRoots: [{ path: root }],
    });

    expect(runtime.diagnostics.map((d) => d.code)).toContain("invalid_extension_id");
  });

  test("reports diagnostics when default export is not an object", async () => {
    const root = createTempDir();
    mkdirSync(join(root, "broken"));
    writeFileSync(join(root, "broken", "extension.ts"), `export default "nope";`);

    const runtime = await loadExtensionRuntime({
      includeUserRoot: false,
      extensionRoots: [{ path: root }],
    });

    expect(runtime.diagnostics.map((d) => d.code)).toContain("invalid_default_export");
  });
});
