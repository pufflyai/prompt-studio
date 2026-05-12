import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  checkExtensionSource,
  checkExtensionsRoot,
  hashExtensionSource,
  loadExtensionSource,
} from "./extension-runtime";

const makeExtension = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-extension-runtime-test-"));
  writePackage(root, "x", { publisher: "pstdio" });
  writeFileSync(join(root, "extension.ts"), "export default {};\n");
  return root;
};

const writePackage = (root: string, name: string, fields: Record<string, unknown> = {}) => {
  writeFileSync(
    join(root, "package.json"),
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

describe("hashExtensionSource", () => {
  test("uses the same .gitignore matcher as source watching", () => {
    const root = makeExtension();
    writeFileSync(join(root, ".gitignore"), "dist/\n*.log\n");
    mkdirSync(join(root, "dist"), { recursive: true });
    writeFileSync(join(root, "dist", "bundle.js"), "one");
    writeFileSync(join(root, "debug.log"), "one");

    try {
      const before = hashExtensionSource(root);

      writeFileSync(join(root, "dist", "bundle.js"), "two");
      writeFileSync(join(root, "debug.log"), "two");

      expect(hashExtensionSource(root)).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("hashes generated files when the extension does not ignore them", () => {
    const root = makeExtension();
    mkdirSync(join(root, "dist"), { recursive: true });
    writeFileSync(join(root, "dist", "lab-page.html"), "one");

    try {
      const before = hashExtensionSource(root);

      writeFileSync(join(root, "dist", "lab-page.html"), "two");

      expect(hashExtensionSource(root)).not.toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("ignores git metadata without deleting it", () => {
    const root = makeExtension();
    mkdirSync(join(root, ".git"), { recursive: true });
    writeFileSync(join(root, ".git", "HEAD"), "one");

    try {
      const before = hashExtensionSource(root);

      writeFileSync(join(root, ".git", "HEAD"), "two");

      expect(hashExtensionSource(root)).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("extension-lab", () => {
  test("uses a source webview entry without explicit webviewBuild metadata", async () => {
    const sourcePath = resolve(import.meta.dir, "../../../../../extensions/extension-lab");
    const loaded = await loadExtensionSource(sourcePath);
    const result = await checkExtensionSource(sourcePath, resolve(sourcePath, ".."));

    expect("webviewBuild" in loaded.manifest).toBe(false);
    expect(result.check.errorCount).toBe(0);
    expect(result.check.routes[0]?.webview.entry.path).toBe("./src/main.tsx");
  });
});

describe("checkExtensionSource webviews", () => {
  test("preserves package manifest missing field diagnostics", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-missing-manifest-fields-"));
    writeFileSync(join(root, "extension.ts"), "export default {};\n");
    writePackage(root, "missing-fields", { publisher: undefined, main: undefined, engines: {} });

    try {
      const result = await checkExtensionSource(root, resolve(root, ".."));

      expect(result.loaded).toBeNull();
      expect(result.check.errorCount).toBe(3);
      expect(result.check.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
        "extension_manifest_missing_field",
        "extension_manifest_missing_field",
        "extension_manifest_missing_field",
      ]);
      expect(result.check.diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
        'package.json is missing required field "publisher"',
        'package.json is missing required field "main"',
        'package.json is missing required field "engines.pstdio"',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reports unsupported webview entry extensions", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-webview-validation-"));
    writePackage(root, "invalid-webview");
    writeFileSync(
      join(root, "extension.ts"),
      `export default {
        routes: {
          page: {
            path: "page",
            label: "Page",
            webview: { entry: { kind: "package-asset", path: "./page.md", baseUrl: import.meta.url } },
          },
        },
      };`,
    );
    writeFileSync(join(root, "page.md"), "# page");

    try {
      const result = await checkExtensionSource(root, resolve(root, ".."));

      expect(result.check.errorCount).toBe(1);
      expect(result.check.diagnostics[0]).toMatchObject({
        code: "route_webview_unsupported",
        severity: "error",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reports native appearance contributions", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-appearance-validation-"));
    writePackage(root, "appearance");
    writeFileSync(
      join(root, "theme.json"),
      `{
        // VS Code themes are JSONC and commonly include trailing commas.
        "colors": { "editor.background": "#272822", "editor.foreground": "#f8f8f2", },
        "tokenColors": [{ "scope": "comment", "settings": { "foreground": "#75715e", "fontStyle": "italic", }, },],
      }`,
    );
    writeFileSync(join(root, "icons.json"), `{ "iconDefinitions": {}, "fileExtensions": {}, }`);
    writeFileSync(
      join(root, "extension.ts"),
      `export default {
        themes: {
          monokai: {
            title: "Monokai",
            format: "vscode-color-theme",
            mode: "dark",
            source: { kind: "package-asset", path: "./theme.json", baseUrl: import.meta.url },
          },
        },
        fileIconThemes: {
          seti: {
            title: "Seti",
            format: "vscode-file-icon-theme",
            source: { kind: "package-asset", path: "./icons.json", baseUrl: import.meta.url },
          },
        },
      };`,
    );

    try {
      const result = await checkExtensionSource(root, resolve(root, ".."));

      expect(result.check.errorCount).toBe(0);
      expect(result.check.themes[0]).toMatchObject({
        id: "appearance.monokai",
        extensionId: "pstdio.appearance",
        format: "vscode-color-theme",
        mode: "dark",
        monacoTheme: {
          rules: [{ token: "comment", foreground: "75715e", fontStyle: "italic" }],
        },
      });
      expect(result.check.fileIconThemes[0]).toMatchObject({
        id: "appearance.seti",
        extensionId: "pstdio.appearance",
        format: "vscode-file-icon-theme",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects unsafe appearance package asset paths", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-unsafe-appearance-"));
    writePackage(root, "unsafeappearance");
    writeFileSync(join(root, "../outside-theme.json"), JSON.stringify({ colors: {} }));
    writeFileSync(join(root, "../outside-icons.json"), JSON.stringify({ iconDefinitions: {} }));
    writeFileSync(
      join(root, "extension.ts"),
      `export default {
        themes: {
          escaped: {
            title: "Escaped",
            format: "vscode-color-theme",
            source: { kind: "package-asset", path: "../outside-theme.json", baseUrl: import.meta.url },
          },
        },
        fileIconThemes: {
          escaped: {
            title: "Escaped Icons",
            format: "vscode-file-icon-theme",
            source: { kind: "package-asset", path: "../outside-icons.json", baseUrl: import.meta.url },
          },
        },
      };`,
    );

    try {
      const result = await checkExtensionSource(root, resolve(root, ".."));

      expect(result.check.errorCount).toBe(2);
      expect(result.check.themes).toEqual([]);
      expect(result.check.fileIconThemes).toEqual([]);
      expect(result.check.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
        "theme_source_invalid",
        "file_icon_theme_source_invalid",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reports absolute appearance package asset paths", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-absolute-appearance-"));
    writePackage(root, "absoluteappearance");
    const themePath = join(root, "theme.json");
    const iconPath = join(root, "icons.json");
    writeFileSync(themePath, JSON.stringify({ colors: {} }));
    writeFileSync(iconPath, JSON.stringify({ iconDefinitions: {} }));
    writeFileSync(
      join(root, "extension.ts"),
      `export default {
        themes: {
          absolute: {
            title: "Absolute",
            format: "vscode-color-theme",
            source: { kind: "package-asset", path: ${JSON.stringify(themePath)}, baseUrl: import.meta.url },
          },
        },
        fileIconThemes: {
          absolute: {
            title: "Absolute Icons",
            format: "vscode-file-icon-theme",
            source: { kind: "package-asset", path: ${JSON.stringify(iconPath)}, baseUrl: import.meta.url },
          },
        },
      };`,
    );

    try {
      const result = await checkExtensionSource(root, resolve(root, ".."));

      expect(result.check.errorCount).toBe(2);
      expect(result.check.themes).toEqual([]);
      expect(result.check.fileIconThemes).toEqual([]);
      expect(result.check.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
        "theme_source_invalid",
        "file_icon_theme_source_invalid",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reports duplicate appearance ids across checked extension folders", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-duplicate-appearance-"));
    const writeAppearanceExtension = (folder: string, name: string) => {
      const extensionRoot = join(root, folder);
      mkdirSync(extensionRoot, { recursive: true });
      writePackage(extensionRoot, name);
      writeFileSync(join(extensionRoot, "theme.json"), JSON.stringify({ colors: {} }));
      writeFileSync(join(extensionRoot, "icons.json"), JSON.stringify({ iconDefinitions: {} }));
      writeFileSync(
        join(extensionRoot, "extension.ts"),
        `export default {
          themes: {
            monokai: {
              title: "Monokai",
              format: "vscode-color-theme",
              source: { kind: "package-asset", path: "./theme.json", baseUrl: import.meta.url },
            },
          },
          fileIconThemes: {
            seti: {
              title: "Seti",
              format: "vscode-file-icon-theme",
              source: { kind: "package-asset", path: "./icons.json", baseUrl: import.meta.url },
            },
          },
        };`,
      );
    };

    writeAppearanceExtension("one", "dup");
    writeAppearanceExtension("two", "dup");

    try {
      const check = await checkExtensionsRoot(root);

      expect(check.themes.map((theme) => theme.id)).toEqual(["dup.monokai"]);
      expect(check.fileIconThemes.map((theme) => theme.id)).toEqual(["dup.seti"]);
      expect(check.diagnostics.map((diagnostic) => diagnostic.code)).toContain("duplicate_theme_id");
      expect(check.diagnostics.map((diagnostic) => diagnostic.code)).toContain("duplicate_file_icon_theme_id");
      expect(check.errorCount).toBeGreaterThanOrEqual(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
