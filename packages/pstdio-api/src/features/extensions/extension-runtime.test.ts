import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { dashboardExtensionHostCapabilities } from "pstdio-extensions";
import {
  checkExtensionSource,
  checkExtensionsRoot,
  hashExtensionSource,
  loadExtensionSource,
} from "./extension-runtime";

const makeExtension = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-extension-runtime-test-"));
  writePackage(root, "x");
  writeFileSync(join(root, "extension.ts"), "export default {};\n");
  return root;
};

const writePackage = (root: string, name: string, fields: Record<string, unknown> = {}) => {
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name,
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
      ...fields,
    }),
  );
};

describe("hashExtensionSource", () => {
  test("ignores files matched by the extension gitignore", () => {
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

  test("hashes generated files when they are not ignored", () => {
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
});

describe("first-party extension loading", () => {
  test("loads Extension Lab with alpha.4 views and typed middleware", async () => {
    const sourcePath = resolve(import.meta.dir, "../../../../../extensions/extension-lab");
    const loaded = await loadExtensionSource(sourcePath);
    const result = await checkExtensionSource(sourcePath, resolve(sourcePath, ".."));

    expect(loaded.manifest.enginesPstdio).toBe(EXTENSION_API_VERSION);
    expect(result.check.errorCount).toBe(0);
    expect(result.check.middlewares).toContainEqual(
      expect.objectContaining({
        commandId: "pstdio.extension-lab.command.awaken",
        id: "pstdio.extension-lab.middleware.reject-sentient-awakening",
      }),
    );
    expect(result.check.views.some((view) => view.body.kind === "webview")).toBe(true);
    expect(result.check).not.toHaveProperty("routes");
  });
});

describe("checkExtensionSource alpha.4", () => {
  test("includes typed keybindings and reports invalid chords", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-keybinding-check-"));
    writePackage(root, "keybinding-check");
    writeFileSync(
      join(root, "extension.ts"),
      `const preview = {
        id: "preview",
        ref: { kind: "command", id: "preview" },
        title: "Preview",
        run: async () => null,
      };
      export default {
        commands: [preview],
        keybindings: [
          { id: "preview", ref: { kind: "keybinding", id: "preview" }, key: "mod+shift+p", win: "ctrl+shift+p", command: preview.ref },
          { id: "duplicate", ref: { kind: "keybinding", id: "duplicate" }, key: "cmd+shift+p", command: preview.ref },
          { id: "modifier-only", ref: { kind: "keybinding", id: "modifier-only" }, key: "ctrl", command: preview.ref },
        ],
      };`,
    );

    try {
      const result = await checkExtensionSource(root, resolve(root, ".."));
      expect(result.check.keybindings).toEqual([
        expect.objectContaining({
          id: "pstdio.keybinding-check.keybinding.preview",
          commandId: "pstdio.keybinding-check.command.preview",
          canonicalChord: "Mod+Shift+P",
        }),
      ]);
      expect(result.check.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "duplicate_keybinding_chord" }),
          expect.objectContaining({ code: "invalid_keybinding" }),
        ]),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reports duplicate keybindings across extension folders", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-duplicate-keybinding-"));
    for (const [folder, name, key] of [
      ["two", "second", "mod+shift+p"],
      ["one", "first", "cmd+shift+p"],
    ] as const) {
      const extensionRoot = join(root, folder);
      mkdirSync(extensionRoot, { recursive: true });
      writePackage(extensionRoot, name);
      writeFileSync(
        join(extensionRoot, "extension.ts"),
        `const preview = { id: "preview", ref: { kind: "command", id: "preview" }, title: "Preview", run: async () => null };
        export default {
          commands: [preview],
          keybindings: [{ id: "preview", ref: { kind: "keybinding", id: "preview" }, key: ${JSON.stringify(key)}, command: preview.ref }],
        };`,
      );
    }

    try {
      const check = await checkExtensionsRoot(root);
      expect(check.keybindings?.map((binding) => binding.id)).toEqual(["pstdio.first.keybinding.preview"]);
      expect(check.diagnostics).toContainEqual(expect.objectContaining({ code: "duplicate_keybinding_chord" }));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("checks native view bridge capabilities", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-host-capability-"));
    writePackage(root, "host-capability-check");
    writeFileSync(
      join(root, "extension.ts"),
      `export default {
        views: [{
          id: "rows",
          ref: { kind: "view", id: "rows" },
          title: "Rows",
          body: { kind: "dataTable", columns: [], query: async () => ({ rows: [] }) },
        }],
      };`,
    );
    const hostCapabilities = {
      ...dashboardExtensionHostCapabilities,
      hostVersion: "0.25.1",
      capabilities: Object.fromEntries(
        Object.entries(dashboardExtensionHostCapabilities.capabilities).filter(
          ([name]) => name !== "view.data-table.v1",
        ),
      ),
    };

    try {
      const result = await checkExtensionSource(root, resolve(root, ".."), { hostCapabilities });
      expect(result.check.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "extension_host_capability_missing",
          metadata: expect.objectContaining({
            contributionId: "pstdio.host-capability-check.view.rows",
            missingCapability: "view.data-table.v1",
          }),
        }),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects removed alpha.3 collections", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-removed-alpha3-"));
    writePackage(root, "removed-alpha3");
    writeFileSync(join(root, "extension.ts"), "export default { panels: {}, routes: {} };");

    try {
      const result = await checkExtensionSource(root, resolve(root, ".."));
      expect(result.check.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "removed_extension_contribution", metadata: { key: "panels" } }),
          expect.objectContaining({ code: "removed_extension_contribution", metadata: { key: "routes" } }),
        ]),
      );
      expect(result.check.views).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reports invalid view source and webview capabilities", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-invalid-webview-"));
    writePackage(root, "invalid-webview");
    writeFileSync(
      join(root, "extension.ts"),
      `export default {
        views: [{
          id: "page",
          ref: { kind: "view", id: "page" },
          title: "Page",
          body: {
            kind: "webview",
            entry: { kind: "package-asset", path: "./page.md", baseUrl: import.meta.url },
            capabilities: ["commands.execute@2", "shell.escape"],
          },
        }],
      };`,
    );
    writeFileSync(join(root, "page.md"), "# page");

    try {
      const result = await checkExtensionSource(root, resolve(root, ".."));
      expect(result.check.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
        expect.arrayContaining([
          "view_webview_unsupported",
          "unsupported_webview_capability_version",
          "unsupported_webview_capability",
        ]),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("preserves missing package manifest field diagnostics", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-missing-fields-"));
    writeFileSync(join(root, "extension.ts"), "export default {};\n");
    writePackage(root, "missing-fields", { publisher: undefined, main: undefined, engines: {} });

    try {
      const result = await checkExtensionSource(root, resolve(root, ".."));
      expect(result.loaded).toBeNull();
      expect(result.check.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
        "extension_manifest_missing_field",
        "extension_manifest_missing_field",
        "extension_manifest_missing_field",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
