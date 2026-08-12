import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncInstalledExtensionsForProject } from "./installed-extension-sync";

const writeExtension = (root: string) => {
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "lab",
      version: "1.0.0",
      displayName: "Lab",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
    }),
  );
  writeFileSync(join(root, "extension.ts"), "export default {};");
};

describe("syncInstalledExtensionsForProject", () => {
  test("does not discover an extension while its dependencies are still installing", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-installing-sync-test-"));
    const sourcePath = join(root, "extension-lab");
    const synced: string[] = [];
    writeExtension(sourcePath);
    writeFileSync(join(sourcePath, ".pstdio-installing"), "");

    try {
      await syncInstalledExtensionsForProject({
        extensionsRoot: root,
        extensionService: {
          syncInstalledSourceForProject: async (input) => {
            synced.push(input.installName);
          },
        },
        projectId: "project-1",
      });

      expect(synced).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
