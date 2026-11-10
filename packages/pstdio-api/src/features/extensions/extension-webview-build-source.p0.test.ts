import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectManagedWebviewBuildInputs, prepareManagedWebviewBuildSource } from "./extension-webview-build-source";

describe("prepareManagedWebviewBuildSource", () => {
  test("returns an actionable failure before preparing a shell when declared dependencies are missing", () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-build-source-test-"));
    const packagePath = join(root, "extension");
    const entryPath = join(packagePath, "src", "main.tsx");
    const shellDir = join(root, "cache", "source");
    mkdirSync(join(packagePath, "src"), { recursive: true });
    writeFileSync(
      join(packagePath, "package.json"),
      JSON.stringify({
        name: "test-extension",
        dependencies: { react: "^19.0.0", zustand: "^5.0.0" },
      }),
    );
    writeFileSync(entryPath, 'import "react";\nimport "zustand";\n');
    mkdirSync(join(packagePath, "node_modules", "react"), { recursive: true });
    writeFileSync(
      join(packagePath, "node_modules", "react", "package.json"),
      JSON.stringify({ name: "react", version: "19.0.0" }),
    );

    try {
      const buildInputs = inspectManagedWebviewBuildInputs({
        entryPath,
        installName: "test-extension",
        packageName: "test-extension",
        packagePath,
      });
      const result = prepareManagedWebviewBuildSource({
        buildInputs,
        entryPath,
        installName: "test-extension",
        packageName: "test-extension",
        packagePath,
        shellDir,
      });

      expect(result.success).toBe(false);
      if (result.success) throw new Error("Expected missing dependencies to fail source preparation.");
      expect(buildInputs.missingDependencies).toEqual(["zustand"]);
      expect(result.details).not.toContain("react");
      expect(result.details).toContain("zustand");
      expect(result.details).toContain("bun install");
      expect(existsSync(shellDir)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("inspectManagedWebviewBuildInputs", () => {
  test("ignores declared dependencies outside the webview source graph", () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-used-dependencies-test-"));
    const packagePath = join(root, "extension");
    const entryPath = join(packagePath, "src", "main.tsx");
    mkdirSync(join(packagePath, "src"), { recursive: true });
    mkdirSync(join(packagePath, "node_modules", "react"), { recursive: true });
    writeFileSync(entryPath, 'import "react";\n');
    writeFileSync(
      join(packagePath, "node_modules", "react", "package.json"),
      JSON.stringify({ name: "react", version: "19.0.0" }),
    );
    writeFileSync(
      join(packagePath, "package.json"),
      JSON.stringify({
        name: "test-extension",
        dependencies: { react: "^19.0.0", zustand: "^5.0.0" },
      }),
    );

    try {
      const first = inspectManagedWebviewBuildInputs({
        entryPath,
        installName: "test-extension",
        packageName: "test-extension",
        packagePath,
      });

      writeFileSync(join(packagePath, "bun.lock"), "unrelated lockfile change");
      writeFileSync(
        join(packagePath, "package.json"),
        JSON.stringify({
          name: "test-extension",
          dependencies: {
            react: "^19.0.0",
            zustand: "^6.0.0",
            immer: "^10.0.0",
          },
        }),
      );
      const second = inspectManagedWebviewBuildInputs({
        entryPath,
        installName: "test-extension",
        packageName: "test-extension",
        packagePath,
      });

      expect(first.dependencyNames).toEqual(["react"]);
      expect(first.missingDependencies).toEqual([]);
      expect(second.dependencyNames).toEqual(["react"]);
      expect(second.signature).toBe(first.signature);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("produces the same signature for identical packages in different roots", () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-build-signature-test-"));
    const createPackage = (name: string) => {
      const packagePath = join(root, name);
      const entryPath = join(packagePath, "src", "main.ts");
      mkdirSync(join(packagePath, "src"), { recursive: true });
      writeFileSync(join(packagePath, "package.json"), JSON.stringify({ name: "test-extension" }));
      writeFileSync(entryPath, "export const value = 1;");
      return {
        entryPath,
        installName: "test-extension",
        packageName: "test-extension",
        packagePath,
      };
    };

    try {
      const first = inspectManagedWebviewBuildInputs(createPackage("first"));
      const second = inspectManagedWebviewBuildInputs(createPackage("second"));

      expect(first.signature).toBe(second.signature);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("delimits source paths from their contents in the signature", () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-build-signature-test-"));
    const packagePath = join(root, "extension");
    const firstEntryPath = join(packagePath, "src", "a");
    const secondEntryPath = join(packagePath, "src", "ab");
    mkdirSync(join(packagePath, "src"), { recursive: true });
    writeFileSync(join(packagePath, "package.json"), JSON.stringify({ name: "test-extension" }));
    writeFileSync(firstEntryPath, "bc");
    writeFileSync(secondEntryPath, "c");

    try {
      const shared = {
        installName: "test-extension",
        packageName: "test-extension",
        packagePath,
      };
      const first = inspectManagedWebviewBuildInputs({
        ...shared,
        entryPath: firstEntryPath,
      });
      const second = inspectManagedWebviewBuildInputs({
        ...shared,
        entryPath: secondEntryPath,
      });

      expect(first.signature).not.toBe(second.signature);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

for (const config of ["paths alias", "nested compiler config"]) {
  test(`frontend identity includes ${config} inputs`, () => {
    const packagePath = mkdtempSync(join(tmpdir(), "webview-compiler-inputs-"));
    mkdirSync(join(packagePath, "src"));
    writeFileSync(join(packagePath, "package.json"), JSON.stringify({ name: "compiler-inputs" }));
    const entryPath = join(packagePath, "src", "main.tsx");
    const configPath = join(packagePath, config === "paths alias" ? "tsconfig.json" : "src/tsconfig.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        compilerOptions: config === "paths alias" ? { paths: { "@local/*": ["./src/*"] } } : { jsx: "react-jsx" },
      }),
    );
    writeFileSync(
      entryPath,
      config === "paths alias"
        ? 'import { value } from "@local/helper"; console.log(value);'
        : "export default <div />;",
    );
    writeFileSync(join(packagePath, "src", "helper.ts"), "export const value = 1;");
    const inspect = () =>
      inspectManagedWebviewBuildInputs({
        entryPath,
        packagePath,
        packageName: "compiler-inputs",
        installName: "compiler-inputs",
      }).signature;
    try {
      const first = inspect();
      if (config === "paths alias") writeFileSync(join(packagePath, "src", "helper.ts"), "export const value = 2;");
      else writeFileSync(configPath, JSON.stringify({ compilerOptions: { jsx: "react", jsxFactory: "custom" } }));
      expect(inspect()).not.toBe(first);
    } finally {
      rmSync(packagePath, { recursive: true, force: true });
    }
  });
}

test("frontend identity follows external extended configuration and escaping aliases", () => {
  const root = mkdtempSync(join(tmpdir(), "external-compiler-inputs-"));
  const packagePath = join(root, "source");
  mkdirSync(packagePath);
  mkdirSync(join(root, "shared"));
  writeFileSync(join(packagePath, "package.json"), JSON.stringify({ name: "external-config" }));
  const config = join(root, "compiler.json");
  const original = JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@shared/*": ["./shared/*"] } } });
  writeFileSync(config, original);
  writeFileSync(join(packagePath, "tsconfig.json"), JSON.stringify({ extends: "../compiler.json" }));
  writeFileSync(join(root, "shared", "helper.ts"), "export const value = 1;");
  const entryPath = join(packagePath, "main.ts");
  writeFileSync(entryPath, 'import { value } from "@shared/helper"; console.log(value);');
  const inspect = () =>
    inspectManagedWebviewBuildInputs({
      entryPath,
      packagePath,
      packageName: "external-config",
      installName: "external-config",
    }).signature;
  try {
    const first = inspect();
    writeFileSync(config, original.replace('"baseUrl":"."', '"baseUrl":".","jsx":"react"'));
    expect(inspect()).not.toBe(first);
    writeFileSync(config, original);
    writeFileSync(join(root, "shared", "helper.ts"), "export const value = 2;");
    expect(inspect()).not.toBe(first);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

for (const mode of ["tsx entry", "ts importer", "jsx pragma"])
  test(`frontend identity retains a custom JSX runtime for ${mode}`, () => {
    const root = mkdtempSync(join(tmpdir(), "custom-jsx-compiler-inputs-"));
    const packagePath = join(root, "source");
    const dependency = join(packagePath, "node_modules", "custom-jsx");
    mkdirSync(dependency, { recursive: true });
    writeFileSync(join(packagePath, "package.json"), JSON.stringify({ name: "custom-jsx-inputs" }));
    writeFileSync(
      join(root, "jsx-base.json"),
      '{ /* inherited compiler settings */ "compilerOptions": { "jsxImportSource": "custom-jsx", }, }',
    );
    if (mode !== "jsx pragma")
      writeFileSync(join(packagePath, "tsconfig.json"), JSON.stringify({ extends: "../jsx-base.json" }));
    writeFileSync(
      join(dependency, "package.json"),
      JSON.stringify({
        name: "custom-jsx",
        exports: { "./jsx-runtime": "./index.js", "./jsx-dev-runtime": "./index.js" },
      }),
    );
    const runtime = join(dependency, "index.js");
    writeFileSync(runtime, "export const jsx = () => 1;");
    const entryPath = join(packagePath, mode === "ts importer" ? "main.ts" : "main.tsx");
    let content = "export default <div />;";
    if (mode === "ts importer") {
      writeFileSync(join(packagePath, "view.tsx"), content);
      content = 'export { default } from "./view.tsx";';
    }
    if (mode === "jsx pragma") content = `/** @jsxImportSource custom-jsx */\n${content}`;
    writeFileSync(entryPath, content);
    const inspect = () =>
      inspectManagedWebviewBuildInputs({
        entryPath,
        packagePath,
        packageName: "custom-jsx-inputs",
        installName: "custom-jsx-inputs",
      }).signature;
    try {
      const first = inspect();
      writeFileSync(runtime, "export const jsx = () => 2;");
      expect(inspect()).not.toBe(first);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
