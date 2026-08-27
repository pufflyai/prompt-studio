import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadExtensionCatalog, packagedExtensionCatalog, parseExtensionCatalog } from "./extension-catalog";

const entry = (installName: string) => ({
  installName,
  displayName: installName,
  description: `${installName} description`,
  origin: {
    kind: "git" as const,
    url: `https://example.com/${installName}.git`,
    path: `extensions/${installName}`,
    ref: "v1.0.0",
  },
  publisher: "example",
  default: false,
});

describe("extension catalog", () => {
  test("rejects duplicate install names", () => {
    expect(() =>
      parseExtensionCatalog({
        version: 1,
        extensions: [entry("recipes"), entry("recipes")],
      }),
    ).toThrow("Duplicate extension catalog install name: recipes");
  });

  test("loads a local operator catalog", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-catalog-"));
    const path = join(root, "catalog.json");
    writeFileSync(path, JSON.stringify({ version: 1, extensions: [entry("recipes")] }));

    try {
      const catalog = await loadExtensionCatalog({
        env: { PSTDIO_EXTENSION_CATALOG: path },
        pstdioHome: join(root, "home"),
      });

      expect(catalog.extensions.map(({ installName }) => installName)).toEqual(["recipes"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("uses the cached remote catalog when the network is unavailable", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-catalog-"));
    const pstdioHome = join(root, "home");
    const url = "https://catalog.example/extensions.json";

    try {
      await loadExtensionCatalog({
        env: { PSTDIO_EXTENSION_CATALOG: url },
        fetch: async () => new Response(JSON.stringify({ version: 1, extensions: [entry("cached")] })),
        pstdioHome,
      });
      const catalog = await loadExtensionCatalog({
        env: { PSTDIO_EXTENSION_CATALOG: url },
        fetch: async () => {
          throw new Error("offline");
        },
        pstdioHome,
      });

      expect(catalog.extensions[0]?.installName).toBe("cached");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("does not reuse a cached catalog from another URL", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-catalog-"));
    const pstdioHome = join(root, "home");
    try {
      await loadExtensionCatalog({
        env: { PSTDIO_EXTENSION_CATALOG: "https://first.example/extensions.json" },
        fetch: async () => new Response(JSON.stringify({ version: 1, extensions: [entry("first")] })),
        pstdioHome,
      });

      await expect(
        loadExtensionCatalog({
          env: { PSTDIO_EXTENSION_CATALOG: "https://second.example/extensions.json" },
          fetch: async () => {
            throw new Error("second offline");
          },
          pstdioHome,
        }),
      ).rejects.toThrow("second offline");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("ships only platform extensions as defaults", () => {
    const defaults = packagedExtensionCatalog.extensions
      .filter((catalogEntry) => catalogEntry.default)
      .map((catalogEntry) => catalogEntry.installName);

    expect(defaults).toEqual([
      "harness-claude-code",
      "harness-codex",
      "harness-open-code",
      "pstdio-base-themes",
      "pstdio-skills",
    ]);
  });
});
