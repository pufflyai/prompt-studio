import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { checkExtensionSource, checkExtensionsRoot } from "./extension-runtime";

const tempDirs: string[] = [];

const writePackage = (root: string, name: string) => {
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify(
      {
        name,
        version: "1.0.0",
        publisher: "pstdio",
        main: "./extension.ts",
        engines: { pstdio: "^1.0.0" },
      },
      null,
      2,
    ),
  );
};

const createExtension = (name: string, extensionSource: string) => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-extension-mode-layout-"));
  tempDirs.push(root);
  writePackage(root, name);
  writeFileSync(join(root, "extension.ts"), extensionSource);
  return root;
};

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

describe("extension mode layout validation", () => {
  test("reports unsafe reset targets and unknown mode layout views", async () => {
    const root = createExtension(
      "bad-mode-layout",
      `export default {
        modes: {
          lab: {
            id: "pstdio.bad-mode-layout.lab",
            label: "Lab",
            layout: {
              reset: ["workbench.nav"],
              open: [{ target: "workbench.main", view: "missing" }],
            },
          },
        },
      };`,
    );

    const result = await checkExtensionSource(root, resolve(root, ".."));

    expect(result.check.modes).toEqual([]);
    expect(result.check.errorCount).toBe(1);
    expect(result.check.diagnostics[0]).toMatchObject({
      code: "extension_mode_layout_invalid",
      extensionId: "pstdio.bad-mode-layout",
      metadata: expect.objectContaining({
        modeId: "pstdio.bad-mode-layout.lab",
        missingView: "missing",
        unsafeResetTargets: ["workbench.nav"],
      }),
    });
  });

  test("reports duplicate mode ids across checked extension folders", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-mode-duplicates-"));
    tempDirs.push(root);
    const writeModeExtension = (folder: string, name: string) => {
      const extensionRoot = join(root, folder);
      mkdirSync(extensionRoot, { recursive: true });
      writePackage(extensionRoot, name);
      writeFileSync(
        join(extensionRoot, "extension.ts"),
        `export default {
          modes: {
            lab: { id: "pstdio.shared.lab", label: "Lab" },
          },
        };`,
      );
    };

    writeModeExtension("two", "two");
    writeModeExtension("one", "one");

    const check = await checkExtensionsRoot(root);

    expect(check.modes.map((mode) => mode.modeId)).toEqual(["pstdio.shared.lab"]);
    expect(check.diagnostics).toEqual([
      expect.objectContaining({
        code: "extension_mode_duplicate",
        extensionId: "pstdio.two",
      }),
    ]);
  });
});
