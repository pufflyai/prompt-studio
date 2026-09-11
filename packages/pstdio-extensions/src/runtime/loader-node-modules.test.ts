import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionDiagnostic } from "../types/runtime";
import { loadExtensionPackage } from "./loader";

const tempDirs: string[] = [];
let previousPstdioHome: string | undefined;

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-loader-node-modules-"));
  tempDirs.push(dir);
  return dir;
};

const isolateRuntimeCache = () => {
  previousPstdioHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(createTempDir(), "pstdio-home");
};

const writePackage = (dir: string) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: "loader-test",
        version: "1.0.0",
        publisher: "pstdio",
        main: "./extension.ts",
        engines: { pstdio: EXTENSION_API_VERSION },
      },
      null,
      2,
    ),
  );
};

afterEach(() => {
  if (previousPstdioHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousPstdioHome;

  previousPstdioHome = undefined;
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

test.each(["e2e", "@workspace/e2e"])("loads workspace dependency %s from the runtime cache", async (name) => {
  isolateRuntimeCache();
  const repoDir = createTempDir();
  const extensionDir = join(repoDir, "extensions", "loader-test");
  const dependencyDir = join(repoDir, "packages", "e2e");
  const dependencyImport = JSON.stringify(name);
  writePackage(extensionDir);
  mkdirSync(dependencyDir, { recursive: true });
  writeFileSync(
    join(dependencyDir, "package.json"),
    JSON.stringify({ name, version: "1.0.0", type: "module", exports: "./index.ts" }),
  );
  writeFileSync(join(dependencyDir, "index.ts"), `export const marker = "workspace-dependency";\n`);
  writeFileSync(
    join(extensionDir, "extension.ts"),
    `import { marker } from ${dependencyImport};

export default {
  commands: {
    check: {
      title: marker,
      run: async () => ({ marker }),
    },
  },
};
`,
  );

  const linkedDependency = join(repoDir, "node_modules", name);
  mkdirSync(dirname(linkedDependency), { recursive: true });
  symlinkSync(dependencyDir, linkedDependency, process.platform === "win32" ? "junction" : "dir");

  const diagnostics: ExtensionDiagnostic[] = [];
  const loaded = await loadExtensionPackage({ path: extensionDir }, diagnostics);
  const commands = loaded?.definition.commands as Record<string, { title: string }> | undefined;

  expect(diagnostics).toEqual([]);
  expect(commands?.check.title).toBe("workspace-dependency");
});
