import { expect, spyOn, test } from "bun:test";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  collectRuntimeModulePaths,
  mirrorRuntimeSourceSnapshot,
  readRuntimeModuleImports,
} from "./runtime-source-snapshot";

test("snapshots the runtime import graph and symlinks unrelated artifacts", () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-runtime-source-snapshot-test-"));
  const packagePath = join(root, "extension");
  const targetPath = join(root, "runtime");
  const entryPath = join(packagePath, "extension.ts");
  mkdirSync(join(packagePath, "dist"), { recursive: true });
  mkdirSync(join(packagePath, "src"), { recursive: true });
  writeFileSync(join(packagePath, "package.json"), JSON.stringify({ name: "test-extension" }));
  writeFileSync(join(packagePath, "dist", "unrelated.js"), "export const unrelated = true;");
  writeFileSync(join(packagePath, "src", "contributions.ts"), `export const title = "Imported";`);
  writeFileSync(join(packagePath, "CHANGELOG.md"), "# Changelog\n");
  writeFileSync(entryPath, `import { title } from "./src/contributions"; export default { title };`);

  try {
    const modulePaths = collectRuntimeModulePaths(packagePath, entryPath);
    mirrorRuntimeSourceSnapshot(packagePath, targetPath, modulePaths);

    expect(lstatSync(join(targetPath, "extension.ts")).isSymbolicLink()).toBe(false);
    expect(lstatSync(join(targetPath, "src", "contributions.ts")).isSymbolicLink()).toBe(false);
    expect(lstatSync(join(targetPath, "dist")).isSymbolicLink()).toBe(true);

    // Windows can't symlink files without elevated privileges, so unrelated
    // files are copied there instead. Elsewhere they stay symlinks.
    const changelog = lstatSync(join(targetPath, "CHANGELOG.md"));
    expect(changelog.isSymbolicLink()).toBe(process.platform !== "win32");
    expect(readFileSync(join(targetPath, "CHANGELOG.md"), "utf8")).toBe("# Changelog\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reuses import parsing when checking unchanged runtime modules again", () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-runtime-source-recheck-"));
  const entry = join(root, "extension.ts");
  writeFileSync(entry, 'export { title } from "./shared";');
  writeFileSync(join(root, "shared.ts"), 'export const title = "Shared";');
  const scan = spyOn(Bun.Transpiler.prototype, "scanImports");

  try {
    const first = collectRuntimeModulePaths(root, entry);
    expect(first).toEqual(new Set(["extension.ts", "shared.ts"]));
    expect(collectRuntimeModulePaths(root, entry)).toEqual(first);
    expect(collectRuntimeModulePaths(root, entry)).toEqual(first);
    // Fingerprint validation must still check the graph, without parsing unchanged files again.
    expect(scan).toHaveBeenCalledTimes(2);
  } finally {
    scan.mockRestore();
    rmSync(root, { recursive: true, force: true });
  }
});

test("refreshes the import graph after a same-size edit with its modification time restored", () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-runtime-source-edit-"));
  const entry = join(root, "extension.ts");
  writeFileSync(entry, 'export { title } from "./first";');
  writeFileSync(join(root, "first.ts"), 'export { title } from "./alpha";');
  writeFileSync(join(root, "alpha.ts"), 'export const title = "Alpha";');
  writeFileSync(join(root, "bravo.ts"), 'export const title = "Bravo";');

  try {
    expect(collectRuntimeModulePaths(root, entry)).toContain("alpha.ts");
    const source = join(root, "first.ts");
    const before = statSync(source);
    writeFileSync(source, 'export { title } from "./bravo";');
    utimesSync(source, before.atime, before.mtime);

    const updated = collectRuntimeModulePaths(root, entry);
    expect(updated).toContain("bravo.ts");
    expect(updated).not.toContain("alpha.ts");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolves newly added and removed modules without an importer edit", () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-runtime-source-resolution-"));
  const entry = join(root, "extension.ts");
  writeFileSync(entry, 'export { title } from "./missing";');

  try {
    expect(collectRuntimeModulePaths(root, entry)).toEqual(new Set(["extension.ts"]));
    writeFileSync(join(root, "missing.ts"), 'export const title = "Found";');
    expect(collectRuntimeModulePaths(root, entry)).toContain("missing.ts");
    // Resolution is repeated even when the importing file's contents have not changed.
    rmSync(join(root, "missing.ts"));
    expect(collectRuntimeModulePaths(root, entry)).toEqual(new Set(["extension.ts"]));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("scans mixed source loaders and refreshes higher-priority import resolution", () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-runtime-source-loaders-"));
  const entry = join(root, "extension.ts");
  writeFileSync(entry, 'export { view } from "./view";');
  writeFileSync(join(root, "view.jsx"), 'import { label } from "./label.mjs"; export const view = <div>{label}</div>;');
  writeFileSync(join(root, "label.mjs"), 'export const label = "Label";');

  try {
    const first = collectRuntimeModulePaths(root, entry);
    expect(first).toEqual(new Set(["extension.ts", "view.jsx", "label.mjs"]));
    writeFileSync(join(root, "view.tsx"), 'export const view = <div>{("Typed" satisfies string)}</div>;');
    expect(collectRuntimeModulePaths(root, entry)).toEqual(new Set(["extension.ts", "view.tsx"]));
    rmSync(join(root, "view.tsx"));
    expect(collectRuntimeModulePaths(root, entry)).toEqual(first);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reuses parsing across staged copies while resolving each copy's local graph", () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-runtime-source-copies-"));
  const staged = join(root, "staged");
  const installed = join(root, "installed");
  const specifier = `./shared-${crypto.randomUUID()}`;
  const source = `export { title } from ${JSON.stringify(specifier)};`;
  mkdirSync(staged);
  mkdirSync(installed);
  writeFileSync(join(staged, "extension.ts"), source);
  writeFileSync(join(installed, "extension.ts"), source);
  writeFileSync(join(staged, `${specifier}.ts`), 'export const title = "Staged";');
  const scan = spyOn(Bun.Transpiler.prototype, "scanImports");

  try {
    expect(collectRuntimeModulePaths(staged, join(staged, "extension.ts"))).toContain(`${specifier.slice(2)}.ts`);
    expect(collectRuntimeModulePaths(installed, join(installed, "extension.ts"))).toEqual(new Set(["extension.ts"]));
    expect(scan).toHaveBeenCalledTimes(2);
    writeFileSync(join(installed, `${specifier}.tsx`), "export const title = <div>Installed</div>;");
    expect(collectRuntimeModulePaths(installed, join(installed, "extension.ts"))).toContain(
      `${specifier.slice(2)}.tsx`,
    );
    expect(scan).toHaveBeenCalledTimes(3);
  } finally {
    scan.mockRestore();
    rmSync(root, { recursive: true, force: true });
  }
});

test("shares content parsing only for the same loader and constant-folding mode", () => {
  const name = crypto.randomUUID();
  const bytes = Buffer.from(`export const unique${name.replaceAll("-", "")} = () => import("./" + "child");`);
  const read = () => Buffer.from(bytes);
  const scan = spyOn(Bun.Transpiler.prototype, "scanImports");
  const transform = spyOn(Bun.Transpiler.prototype, "transformSync");

  try {
    expect(readRuntimeModuleImports(`${name}.ts`, read)).toEqual([]);
    expect(readRuntimeModuleImports(`${name}.mts`, read)).toEqual([]);
    expect(scan).toHaveBeenCalledTimes(1);
    expect(readRuntimeModuleImports(`${name}.ts`, read, true)).toContain("./child");
    expect(readRuntimeModuleImports(`${name}-copy.ts`, read, true)).toContain("./child");
    expect(transform).toHaveBeenCalledTimes(1);
    expect(scan).toHaveBeenCalledTimes(2);
    expect(readRuntimeModuleImports(`${name}.js`, read)).toEqual([]);
    expect(scan).toHaveBeenCalledTimes(3);
  } finally {
    scan.mockRestore();
    transform.mockRestore();
  }
});
