import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { dashboardExtensionHostCapabilities } from "pstdio-extensions";
import {
  checkExtensionSource,
  checkExtensionsRoot,
  formatExtensionsCheck,
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
    expect(result.check.middlewares).toEqual([
      expect.objectContaining({
        commandId: "extension-lab.awaken",
        id: "extension-lab.rejectSentientAwakening",
      }),
    ]);
    expect(result.check.themes).toEqual([]);
    expect(result.check.fileIconThemes).toEqual([]);
    expect(result.check.routes[0]?.webview.entry.path).toBe("./src/views/main.tsx");
  });
});

describe("checkExtensionSource keybindings", () => {
  test("includes normalized keybindings and diagnostics in check output", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-keybinding-check-"));
    writePackage(root, "keybinding-check");
    writeFileSync(
      join(root, "extension.ts"),
      `const run = async () => null;
      export default {
        commands: {
          preview: { title: "Preview", run },
        },
        keybindings: {
          preview: { key: "mod+shift+p", win: "ctrl+shift+p", command: "preview" },
          duplicate: { key: "cmd+shift+p", command: "preview" },
          modifierOnly: { key: "ctrl", command: "preview" },
        },
      };`,
    );

    try {
      const result = await checkExtensionSource(root, resolve(root, ".."));

      expect(result.check.keybindings).toEqual([
        expect.objectContaining({
          id: "keybinding-check.preview",
          commandId: "keybinding-check.preview",
          key: "mod+shift+p",
          canonicalChord: "Mod+Shift+P",
          platformOverrides: { win: "ctrl+shift+p" },
        }),
      ]);
      expect(result.check.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "duplicate_keybinding_chord", severity: "warning" }),
          expect.objectContaining({
            code: "invalid_keybinding",
            metadata: expect.objectContaining({ chord: "ctrl" }),
          }),
        ]),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reports duplicate keybindings across checked extension folders", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-duplicate-keybinding-"));
    const writeKeybindingExtension = (folder: string, name: string, key: string) => {
      const extensionRoot = join(root, folder);
      mkdirSync(extensionRoot, { recursive: true });
      writePackage(extensionRoot, name);
      writeFileSync(
        join(extensionRoot, "extension.ts"),
        `const run = async () => null;
        export default {
          commands: {
            preview: { title: "Preview", run },
          },
          keybindings: {
            preview: { key: ${JSON.stringify(key)}, command: "preview" },
          },
        };`,
      );
    };

    writeKeybindingExtension("two", "second", "mod+shift+p");
    writeKeybindingExtension("one", "first", "cmd+shift+p");

    try {
      const check = await checkExtensionsRoot(root);

      expect(check.keybindings.map((binding) => binding.id)).toEqual(["first.preview"]);
      expect(check.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "duplicate_keybinding_chord",
          severity: "warning",
          metadata: expect.objectContaining({ existingId: "first.preview", platform: "mac" }),
        }),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkExtensionSource host compatibility", () => {
  test("fails a valid data table panel when the dashboard lacks the required bridge", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-host-capability-"));
    writePackage(root, "host-capability-check");
    writeFileSync(
      join(root, "extension.ts"),
      `const run = async () => ({ rows: [] });
      export default {
        commands: {
          query: { title: "Query rows", run },
        },
        dataTableRenderers: {
          rows: { title: "Rows", queryCommand: "query" },
        },
        panels: {
          rows: {
            title: "Rows",
            region: "main",
            closable: true,
            dataTableRenderer: "rows",
          },
        },
      };`,
    );
    const hostCapabilities = {
      ...dashboardExtensionHostCapabilities,
      hostVersion: "0.25.1",
      capabilities: Object.fromEntries(
        Object.entries(dashboardExtensionHostCapabilities.capabilities).filter(
          ([name]) => name !== "renderer.data-table.v1" && name !== "panel.data-table-renderer.v1",
        ),
      ),
    };

    try {
      const result = await checkExtensionSource(root, resolve(root, ".."), { hostCapabilities });

      expect(result.check.errorCount).toBe(2);
      expect(result.check.hostCompatibility).toMatchObject({
        status: "verified",
        host: { host: "dashboard", hostVersion: "0.25.1" },
      });
      expect(result.check.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "extension_host_capability_missing",
            metadata: expect.objectContaining({
              contributionId: "host-capability-check.rows",
              missingCapability: "renderer.data-table.v1",
              requiredSince: "0.25.2",
            }),
          }),
          expect.objectContaining({
            code: "extension_host_capability_missing",
            metadata: expect.objectContaining({
              contributionId: "host-capability-check.rows",
              missingCapability: "panel.data-table-renderer.v1",
              requiredSince: "0.25.2",
            }),
          }),
        ]),
      );
      expect(formatExtensionsCheck(result.check)).toContain("Contribution: host-capability-check.rows");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
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

  test("reports unsupported workbench attachment targets", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-invalid-target-"));
    writePackage(root, "invalid-target");
    writeFileSync(
      join(root, "extension.ts"),
      `export default {
        commands: {
          review: {
            title: "Review",
            menus: [{ target: "workbench.left.tree", label: "Wrong target" }],
            run: async () => undefined,
          },
        },
      };`,
    );

    try {
      const result = await checkExtensionSource(root, resolve(root, ".."));

      expect(result.check.errorCount).toBe(1);
      expect(result.check.diagnostics[0]).toMatchObject({
        code: "extension_target_unsupported",
        extensionId: "pstdio.invalid-target",
        metadata: expect.objectContaining({
          contributionId: "invalid-target.review.menu.0",
          expectedKind: "menu",
          target: "workbench.left.tree",
        }),
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reports tree items without a target", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-missing-tree-target-"));
    writePackage(root, "missing-tree-target");
    writeFileSync(
      join(root, "extension.ts"),
      `export default {
        treeItems: {
          lab: {
            label: "Lab",
            action: { kind: "route", route: "lab" },
          },
        },
      };`,
    );

    try {
      const result = await checkExtensionSource(root, resolve(root, ".."));

      expect(result.check.errorCount).toBe(1);
      expect(result.check.treeItems).toEqual([]);
      expect(result.check.diagnostics[0]).toMatchObject({
        code: "extension_target_invalid",
        extensionId: "pstdio.missing-tree-target",
        metadata: expect.objectContaining({
          contributionId: "missing-tree-target.lab",
          expectedKind: "treeItem",
        }),
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

  test("reports unsupported webview capability declarations", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-webview-capabilities-"));
    writePackage(root, "invalid-webview-capabilities");
    writeFileSync(
      join(root, "extension.ts"),
      `export default {
        routes: {
          page: {
            path: "page",
            label: "Page",
            webview: {
              entry: { kind: "package-asset", path: "./page.tsx", baseUrl: import.meta.url },
              capabilities: ["commands.execute@2", "shell.escape"],
            },
          },
        },
      };`,
    );
    writeFileSync(join(root, "page.tsx"), "export default {};");

    try {
      const result = await checkExtensionSource(root, resolve(root, ".."));

      expect(result.check.errorCount).toBe(2);
      expect(result.check.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
        "unsupported_webview_capability_version",
        "unsupported_webview_capability",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkExtensionSource settings panels", () => {
  test("forwards the declared icon onto the settings panel record", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-settings-panel-icon-"));
    writePackage(root, "settings-icon");
    writeFileSync(
      join(root, "extension.ts"),
      `export default {
        settingsPanels: {
          tags: {
            target: "workbench.settings",
            scope: "project",
            title: "Tags",
            icon: "tag",
            webview: { entry: { kind: "package-asset", path: "./tags.tsx", baseUrl: import.meta.url } },
          },
        },
      };`,
    );
    writeFileSync(join(root, "tags.tsx"), "export default () => null;");

    try {
      const result = await checkExtensionSource(root, resolve(root, ".."));

      expect(result.check.settingsPanels).toHaveLength(1);
      expect(result.check.settingsPanels[0]).toMatchObject({
        id: "settings-icon.tags",
        icon: "tag",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkExtensionSource legacy navigation", () => {
  test("reports legacy navigation contributions as unsupported", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-legacy-navigation-"));
    writePackage(root, "legacy-navigation");
    writeFileSync(
      join(root, "extension.ts"),
      `export default {
        navigation: {
          lab: {
            slot: "project.sidenavNav",
            label: "Lab",
            route: "lab",
          },
        },
      };`,
    );

    try {
      const result = await checkExtensionSource(root, resolve(root, ".."));

      expect(result.check.errorCount).toBe(1);
      expect(result.check.navigation).toEqual([]);
      expect(result.check.diagnostics[0]).toMatchObject({
        code: "extension_navigation_unsupported",
        extensionId: "pstdio.legacy-navigation",
        metadata: { contributionId: "legacy-navigation.lab" },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
