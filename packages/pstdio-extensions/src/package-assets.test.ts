import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadExtensionRuntime } from "./index";
import { readPackageAssetText } from "./package-assets";

let tempDirs: string[] = [];

const createProject = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-package-assets-"));
  tempDirs.push(dir);
  return dir;
};

const writeExtension = (projectRoot: string, extensionDir: string, source: string) => {
  const dir = join(projectRoot, ".pstdio", "extensions", extensionDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "extension.ts"), source);
};

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("package asset resolution", () => {
  test("loads and reads assets declared by packageAsset", async () => {
    const projectRoot = createProject();
    const templatesDir = join(projectRoot, ".pstdio", "extensions", "templates");
    mkdirSync(templatesDir, { recursive: true });
    writeFileSync(join(templatesDir, "default-ticket.md"), "Default ticket body");
    writeExtension(
      projectRoot,
      "local.templates",
      `import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";

      export default defineExtension({
        id: "local.templates",
        name: "Templates",
        templates: {
          defaultTicket: {
            title: "Default Ticket",
            type: "ticket",
            source: packageAsset("../templates/default-ticket.md", import.meta.url),
          },
        },
      });`,
    );

    const runtime = await loadExtensionRuntime({ projectRoot });

    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.templates[0]?.id).toBe("local.templates.defaultTicket");
    await expect(
      readPackageAssetText(runtime.templates[0].source, { sourcePath: runtime.extensions[0].sourcePath }),
    ).resolves.toBe("Default ticket body");
  });

  test("reports missing package asset files as diagnostics", async () => {
    const projectRoot = createProject();
    writeExtension(
      projectRoot,
      "local.templates",
      `import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";

      export default defineExtension({
        id: "local.templates",
        name: "Templates",
        templates: {
          missing: {
            title: "Missing",
            type: "ticket",
            source: packageAsset("../templates/missing.md", import.meta.url),
          },
        },
      });`,
    );

    const runtime = await loadExtensionRuntime({ projectRoot });

    expect(runtime.templates).toEqual([]);
    expect(runtime.diagnostics).toEqual([
      expect.objectContaining({
        code: "invalid_package_asset",
        message: expect.stringContaining("does not exist"),
      }),
    ]);
  });

  test("reports package asset paths that escape the extension asset root", async () => {
    const projectRoot = createProject();
    writeExtension(
      projectRoot,
      "local.templates",
      `import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";

      export default defineExtension({
        id: "local.templates",
        name: "Templates",
        templates: {
          unsafe: {
            title: "Unsafe",
            type: "ticket",
            source: packageAsset("../../outside.md", import.meta.url),
          },
        },
      });`,
    );

    const runtime = await loadExtensionRuntime({ projectRoot });

    expect(runtime.templates).toEqual([]);
    expect(runtime.diagnostics).toEqual([
      expect.objectContaining({
        code: "invalid_package_asset",
        message: expect.stringContaining("must stay under the extension asset root"),
      }),
    ]);
  });
});
