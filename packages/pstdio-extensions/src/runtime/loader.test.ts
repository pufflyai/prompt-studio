import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionDiagnostic } from "../types/runtime";
import { loadExtensionPackage } from "./loader";

const tempDirs: string[] = [];
let previousPackagePath: string | undefined;

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-loader-"));
  tempDirs.push(dir);
  return dir;
};

const writePackage = (dir: string) => {
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: "loader-test",
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

afterEach(() => {
  if (previousPackagePath === undefined) delete process.env.PSTDIO_LOADER_TEST_PACKAGE_PATH;
  else process.env.PSTDIO_LOADER_TEST_PACKAGE_PATH = previousPackagePath;

  previousPackagePath = undefined;
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

test("loads a fresh entry without writing runtime files into the source package", async () => {
  const dir = createTempDir();
  mkdirSync(join(dir, "src"));
  writePackage(dir);
  writeFileSync(join(dir, "template.md"), "Template");
  writeFileSync(join(dir, "src", "marker.ts"), `export const marker = "from-relative-module";`);
  writeFileSync(
    join(dir, "extension.ts"),
    `
      import { packageAsset } from "@pstdio/sdk/extensions";
      import { readdirSync, writeFileSync } from "node:fs";
      import { join } from "node:path";
      import { marker } from "./src/marker";

      const packagePath = process.env.PSTDIO_LOADER_TEST_PACKAGE_PATH;
      if (!packagePath) throw new Error("Missing test package path");

      const runtimeEntries = readdirSync(packagePath).filter((name) => name.startsWith(".pstdio-runtime-"));
      writeFileSync(join(packagePath, "runtime-entries.json"), JSON.stringify(runtimeEntries));

      export default {
        commands: {
          check: {
            title: marker,
            run: async () => ({ marker }),
          },
        },
        templates: {
          sample: {
            title: "Sample",
            type: "sample",
            source: packageAsset("./template.md", import.meta.url),
          },
        },
      };
    `,
  );

  previousPackagePath = process.env.PSTDIO_LOADER_TEST_PACKAGE_PATH;
  process.env.PSTDIO_LOADER_TEST_PACKAGE_PATH = dir;

  const diagnostics: ExtensionDiagnostic[] = [];
  const loaded = await loadExtensionPackage({ path: dir }, diagnostics);
  const commands = loaded?.definition.commands as Record<string, { title: string }> | undefined;
  const templates = loaded?.definition.templates as
    | Record<string, { source: { baseUrl: string; path: string } }>
    | undefined;
  const templateSource = templates?.sample.source;

  expect(diagnostics).toEqual([]);
  expect(commands?.check.title).toBe("from-relative-module");
  expect(templateSource ? fileURLToPath(new URL(templateSource.path, templateSource.baseUrl)) : undefined).toBe(
    join(dir, "template.md"),
  );
  expect(JSON.parse(readFileSync(join(dir, "runtime-entries.json"), "utf8"))).toEqual([]);
  expect(readdirSync(dir).filter((name) => name.startsWith(".pstdio-runtime-"))).toEqual([]);
});
