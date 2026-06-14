import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadProjectExtensionRuntime } from "./extension-command-runtime";

const tempRoots: string[] = [];
const projectContext = { id: "project-1", name: "Project One", shorthand: "PO" };

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

const writeRuntimeExtension = (root: string, commandName: string) => {
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "hello",
      version: "1.0.0",
      displayName: "Hello",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
    }),
  );
  writeFileSync(
    join(root, "extension.ts"),
    `export default {
  commands: {
    ${JSON.stringify(commandName)}: { title: ${JSON.stringify(commandName)}, run: async () => undefined },
  },
};`,
  );
};

describe("loadProjectExtensionRuntime stale sources", () => {
  test("skips enabled sources whose package manifest was removed", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-runtime-"));
    tempRoots.push(root);
    const healthyPath = join(root, "healthy");
    const stalePath = join(root, "pstdio-claude-code");
    writeRuntimeExtension(healthyPath, "healthy");
    mkdirSync(stalePath, { recursive: true });

    const { runtime } = await loadProjectExtensionRuntime(
      {
        extensionService: {
          listEnabledSourcesForProject: async () => [
            {
              instance: { id: "healthy-instance", namespace: "hello", enabled: true },
              installedSource: {
                id: "healthy-source",
                extension_id: "pstdio.hello",
                source_kind: "local_path",
                source_path: healthyPath,
                status: "loaded",
              },
            },
            {
              instance: { id: "stale-instance", namespace: "pstdio-claude-code", enabled: true },
              installedSource: {
                id: "stale-source",
                extension_id: "pstdio.pstdio-claude-code",
                source_kind: "local_path",
                source_path: stalePath,
                status: "loaded",
              },
            },
          ],
        },
        repoService: { listByProject: async () => [] },
        projectService: { get: async () => projectContext },
      } as never,
      "project-1",
    );

    expect(runtime.commands.map((command) => command.id)).toEqual(["hello.healthy"]);
    expect(runtime.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain("extension_manifest_not_found");
  });
});
