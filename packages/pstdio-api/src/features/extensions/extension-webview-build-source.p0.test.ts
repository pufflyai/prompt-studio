import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectRevisionDependencies, hashRevisionDependencies } from "pstdio-extensions/revision-dependencies";
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

test("browser expressions do not turn unused declared packages into build inputs", async () => {
  const root = mkdtempSync(join(tmpdir(), "browser-opaque-inputs-"));
  const packagePath = join(root, "extension");
  mkdirSync(packagePath);
  writeFileSync(
    join(packagePath, "package.json"),
    JSON.stringify({ name: "browser-expressions", dependencies: { chosen: "1", unused: "1", computed: "1" } }),
  );
  for (const name of ["chosen", "unused", "computed"]) {
    const path = join(packagePath, "node_modules", name);
    mkdirSync(path, { recursive: true });
    writeFileSync(
      join(path, "package.json"),
      JSON.stringify({ name, exports: { ".": "./index.js", "./index.js": "./index.js" } }),
    );
    writeFileSync(join(path, "index.js"), "export const value = 1;");
  }
  const entryPath = join(packagePath, "main.js");
  writeFileSync(
    entryPath,
    'export { value } from "chosen"; export const resolve = name => import.meta.resolve(name); export const load = name => import(name); export const computed = flag => import(flag ? "computed" + "/index.js" : "chosen");',
  );
  const inspect = () =>
    inspectManagedWebviewBuildInputs({
      packagePath,
      entryPath,
      packageName: "browser-expressions",
      installName: "browser-expressions",
    }).signature;
  const build = () => {
    const outdir = join(root, "dist");
    const result = Bun.spawnSync([process.execPath, "build", entryPath, "--target=browser", `--outdir=${outdir}`]);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    return Bun.file(join(outdir, "main.js")).text();
  };
  try {
    const first = inspect();
    const output = await build();
    writeFileSync(join(packagePath, "node_modules", "unused", "index.js"), "export const value = 2;");
    // A fresh browser compiler preserves these expressions; it does not load unused packages.
    expect(await build()).toBe(output);
    expect(inspect()).toBe(first);
    writeFileSync(join(packagePath, "node_modules", "computed", "index.js"), "export const value = 2;");
    expect(await build()).not.toBe(output);
    expect(inspect()).not.toBe(first);
    const computed = inspect();
    writeFileSync(join(packagePath, "node_modules", "chosen", "index.js"), "export const value = 2;");
    expect(inspect()).not.toBe(computed);
    const changed = inspect();
    writeFileSync(join(packagePath, "asset.json"), "changed opaque asset");
    expect(inspect()).not.toBe(changed);
    for (const [index, expression] of [
      'import("computed" + "/index.js")',
      'import /* comment */ ("computed" + "/index.js")',
    ].entries()) {
      writeFileSync(entryPath, `export const load = () => ${expression};`);
      const before = inspect();
      const runtime = hashRevisionDependencies(collectRevisionDependencies(packagePath, { entryPath }), packagePath);
      const previous = await build();
      writeFileSync(join(packagePath, "node_modules", "computed", "index.js"), `export const value = ${index + 3};`);
      expect(await build()).not.toBe(previous);
      expect(inspect()).not.toBe(before);
      expect(hashRevisionDependencies(collectRevisionDependencies(packagePath, { entryPath }), packagePath)).not.toBe(
        runtime,
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("browser macro execution retains computed Node dependencies", async () => {
  const root = mkdtempSync(join(tmpdir(), "browser-macro-inputs-"));
  const packagePath = join(root, "extension");
  const macro = join(packagePath, "node_modules", "macro-provider");
  const helper = join(root, "helper");
  const hidden = join(helper, "node_modules", "hidden");
  mkdirSync(hidden, { recursive: true });
  mkdirSync(macro, { recursive: true });
  writeFileSync(
    join(packagePath, "package.json"),
    JSON.stringify({ name: "macro-inputs", dependencies: { "macro-provider": "1" } }),
  );
  writeFileSync(join(macro, "package.json"), JSON.stringify({ name: "macro-provider", exports: "./index.js" }));
  writeFileSync(join(macro, "index.js"), `export { value } from ${JSON.stringify(join(helper, "index.js"))};`);
  writeFileSync(join(helper, "package.json"), JSON.stringify({ name: "helper", dependencies: { hidden: "1" } }));
  writeFileSync(
    join(helper, "index.js"),
    `import { readFileSync } from "node:fs"; export function value() { return readFileSync(${JSON.stringify(join(hidden, "index.js"))}, "utf8"); }`,
  );
  writeFileSync(join(hidden, "package.json"), JSON.stringify({ name: "hidden", main: "index.js" }));
  writeFileSync(join(hidden, "index.js"), "exports.value = 1;");
  writeFileSync(join(packagePath, "macro.js"), 'export { value } from "macro-provider";');
  const entryPath = join(packagePath, "main.js");
  writeFileSync(
    entryPath,
    'import { value } from "./macro.js" /* attribute */ with /* comment */ { type: "macro" }; export const result = value();',
  );
  const inspect = () =>
    inspectManagedWebviewBuildInputs({
      packagePath,
      entryPath,
      packageName: "macro-inputs",
      installName: "macro-inputs",
    }).signature;
  const runtimeIdentity = () =>
    hashRevisionDependencies(collectRevisionDependencies(packagePath, { entryPath }), packagePath);
  const build = async () => {
    const outdir = join(root, "dist");
    const result = Bun.spawnSync([process.execPath, "build", entryPath, "--target=browser", `--outdir=${outdir}`]);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    return Bun.file(join(outdir, "main.js")).text();
  };
  try {
    const first = inspect();
    const runtime = runtimeIdentity();
    const output = await build();
    writeFileSync(join(hidden, "index.js"), "exports.value = 2;");
    expect(await build()).not.toBe(output);
    expect(inspect()).not.toBe(first);
    expect(runtimeIdentity()).not.toBe(runtime);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
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

test("frontend identity retains the default development JSX runtime from inherited configuration", () => {
  const root = mkdtempSync(join(tmpdir(), "default-jsx-compiler-inputs-"));
  const packagePath = join(root, "source");
  const dependency = join(packagePath, "node_modules", "react");
  mkdirSync(dependency, { recursive: true });
  writeFileSync(join(packagePath, "package.json"), JSON.stringify({ name: "default-jsx-inputs" }));
  writeFileSync(join(root, "jsx-base.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsxdev" } }));
  writeFileSync(join(packagePath, "tsconfig.json"), JSON.stringify({ extends: "../jsx-base.json" }));
  writeFileSync(
    join(dependency, "package.json"),
    JSON.stringify({
      name: "react",
      exports: { "./jsx-runtime": "./runtime.js", "./jsx-dev-runtime": "./development.js" },
    }),
  );
  writeFileSync(join(dependency, "runtime.js"), "export const jsx = () => 1;");
  const runtime = join(dependency, "development.js");
  writeFileSync(runtime, "export const jsxDEV = () => 1;");
  const entryPath = join(packagePath, "main.tsx");
  writeFileSync(entryPath, "export default <div />;");
  const inspect = () =>
    inspectManagedWebviewBuildInputs({
      entryPath,
      packagePath,
      packageName: "default-jsx-inputs",
      installName: "default-jsx-inputs",
    }).signature;
  try {
    const first = inspect();
    writeFileSync(runtime, "export const jsxDEV = () => 2;");
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
