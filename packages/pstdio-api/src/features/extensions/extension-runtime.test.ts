import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { checkExtensionSource, hashExtensionSource, loadExtensionSource } from "./extension-runtime";

const makeExtension = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-extension-runtime-test-"));
  writeFileSync(
    join(root, "extension.ts"),
    "export default { id: 'x', namespace: 'x', name: 'X', apiVersion: '1' };\n",
  );
  return root;
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
  test("reports unsupported webview entry extensions", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-webview-validation-"));
    writeFileSync(
      join(root, "extension.ts"),
      `export default {
        id: "pstdio.invalid-webview",
        namespace: "invalid",
        name: "Invalid",
        apiVersion: "1",
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
});
