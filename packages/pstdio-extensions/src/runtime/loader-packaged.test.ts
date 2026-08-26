import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionDiagnostic } from "../types/runtime";
import { loadExtensionPackage } from "./loader";

const tempDirs: string[] = [];
let previousEmbeddedFiles: readonly unknown[] | undefined;
let previousPstdioHome: string | undefined;

const setEmbeddedFiles = (value: readonly unknown[] | undefined) => {
  (globalThis.Bun as unknown as { embeddedFiles: unknown[] }).embeddedFiles = [...(value ?? [])];
};

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-loader-packaged-"));
  tempDirs.push(dir);
  return dir;
};

const usePackagedRuntime = () => {
  previousEmbeddedFiles = globalThis.Bun.embeddedFiles;
  setEmbeddedFiles(["pstdio-packaged-test"]);

  previousPstdioHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(createTempDir(), "pstdio-home");
};

const writePackage = (dir: string) => {
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name: "packaged-loader-test",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
    }),
  );
};

const writeSdkDependency = (dir: string) => {
  const sdkDir = join(dir, "node_modules", "@pstdio", "sdk");
  mkdirSync(sdkDir, { recursive: true });
  writeFileSync(
    join(sdkDir, "package.json"),
    JSON.stringify({
      name: "@pstdio/sdk",
      version: "0.0.0-test",
      type: "module",
      exports: { "./extensions": "./extensions.ts" },
    }),
  );
  writeFileSync(
    join(sdkDir, "extensions.ts"),
    `export const packageAsset = (path, baseUrl) => ({ kind: "package-asset", path, baseUrl });`,
  );
};

afterEach(() => {
  setEmbeddedFiles(previousEmbeddedFiles);

  if (previousPstdioHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousPstdioHome;

  previousEmbeddedFiles = undefined;
  previousPstdioHome = undefined;
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

test("keeps package asset urls relative to the source module after packaged bundling", async () => {
  usePackagedRuntime();
  const dir = createTempDir();
  mkdirSync(join(dir, "src"));
  writePackage(dir);
  writeSdkDependency(dir);
  writeFileSync(join(dir, "src", "template.md"), "Template");
  writeFileSync(
    join(dir, "src", "contribution.ts"),
    `
      import { packageAsset } from "@pstdio/sdk/extensions";

      export const templates = [
        {
          id: "sample",
          ref: { kind: "template", id: "sample" },
          title: "Sample",
          type: "sample",
          source: packageAsset("./template.md", import.meta.url),
        },
      ];
    `,
  );
  writeFileSync(
    join(dir, "extension.ts"),
    `
      import { templates } from "./src/contribution";

      export default { templates };
    `,
  );

  const diagnostics: ExtensionDiagnostic[] = [];
  const loaded = await loadExtensionPackage({ path: dir }, diagnostics);
  const templates = loaded?.definition.templates as readonly { source: { baseUrl: string; path: string } }[];
  const source = templates[0]!.source;

  expect(diagnostics).toEqual([]);
  expect(fileURLToPath(new URL(source.path, source.baseUrl))).toBe(join(dir, "src", "template.md"));
});
