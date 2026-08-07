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

const writePackage = (dir: string, name: string, fields: Record<string, unknown> = {}) => {
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name,
        version: "1.0.0",
        publisher: "pstdio",
        main: "./extension.ts",
        engines: { pstdio: "^1.0.0" },
        ...fields,
      },
      null,
      2,
    ),
  );
};

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

describe("loadExtensionRuntime", () => {
  test("loads extensions from a custom root and normalizes their commands", async () => {
    const root = createTempDir();
    mkdirSync(join(root, "lab"));
    writePackage(join(root, "lab"), "lab", { displayName: "Lab" });
    writeFileSync(
      join(root, "lab", "extension.ts"),
      `export default {
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

  test("reports diagnostics when an extension has invalid manifest identity", async () => {
    const root = createTempDir();
    mkdirSync(join(root, "bad"));
    writePackage(join(root, "bad"), "Bad Id");
    writeFileSync(join(root, "bad", "extension.ts"), `export default {};`);

    const runtime = await loadExtensionRuntime({
      includeUserRoot: false,
      extensionRoots: [{ path: root }],
    });

    expect(runtime.diagnostics.map((d) => d.code)).toContain("extension_manifest_invalid_value");
  });

  test("reports diagnostics when default export is not an object", async () => {
    const root = createTempDir();
    mkdirSync(join(root, "broken"));
    writePackage(join(root, "broken"), "broken");
    writeFileSync(join(root, "broken", "extension.ts"), `export default "nope";`);

    const runtime = await loadExtensionRuntime({
      includeUserRoot: false,
      extensionRoots: [{ path: root }],
    });

    expect(runtime.diagnostics.map((d) => d.code)).toContain("invalid_default_export");
  });

  test("warns when a panel declares empty eligible locations", async () => {
    const root = createTempDir();
    mkdirSync(join(root, "lab"));
    writePackage(join(root, "lab"), "lab");
    writeFileSync(
      join(root, "lab", "extension.ts"),
      `export default {
        panels: {
          everywhere: {
            title: "Everywhere",
            region: "main",
            closable: true,
            eligibleLocations: {},
            webview: { entry: "./panel.tsx" },
          },
        },
      };`,
    );

    const runtime = await loadExtensionRuntime({
      includeUserRoot: false,
      extensionRoots: [{ path: root }],
    });

    expect(runtime.diagnostics).toEqual([
      expect.objectContaining({
        code: "extension_panel_empty_eligible_locations",
        severity: "warning",
        metadata: { contributionId: "lab.everywhere" },
      }),
    ]);
  });

  test("does not warn when panel eligibility is absent or constrained", async () => {
    const root = createTempDir();
    mkdirSync(join(root, "lab"));
    writePackage(join(root, "lab"), "lab");
    writeFileSync(
      join(root, "lab", "extension.ts"),
      `export default {
        panels: {
          content: {
            title: "Content",
            region: "main",
            closable: false,
            webview: { entry: "./content.tsx" },
          },
          tickets: {
            title: "Tickets",
            region: "main",
            closable: true,
            eligibleLocations: { resourceKinds: ["ticket"] },
            webview: { entry: "./tickets.tsx" },
          },
        },
      };`,
    );

    const runtime = await loadExtensionRuntime({
      includeUserRoot: false,
      extensionRoots: [{ path: root }],
    });

    expect(runtime.diagnostics.map((d) => d.code)).not.toContain("extension_panel_empty_eligible_locations");
  });
});
