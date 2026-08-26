import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createProjectExtensionRuntimeCatalog } from "../project-extension-runtime-catalog";
import { createExtensionRoutes } from "../routes";

const createApp = (sourcePath: string) => {
  const app = new OpenAPIHono();
  const extensionService = {
    listEnabledSourcesForProject: async () => [
      {
        instance: { namespace: "lab" },
        installedSource: {
          extension_id: "pstdio.lab",
          source_kind: "local_path" as const,
          source_path: sourcePath,
          status: "loaded",
        },
      },
    ],
  };
  const repoService = { listByProject: async () => [] };
  const projectService = {
    get: async () => ({ id: "project-1", name: "Project", shorthand: "PS" }),
  };
  app.route(
    "/v1",
    createExtensionRoutes({
      extensionRuntimeCatalog: createProjectExtensionRuntimeCatalog({
        extensionService: extensionService as never,
        projectService: projectService as never,
        repoService: repoService as never,
      }),
      extensionService,
      projectService,
      repoService,
    } as never),
  );
  return app;
};

describe("list extension appearance", () => {
  test("returns extension translation records", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-translations-route-"));
    writeFileSync(join(root, "fr.json"), JSON.stringify({ "commands.sayHello.title": "Dire bonjour" }));
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        name: "lab",
        version: "1.0.0",
        displayName: "Lab",
        publisher: "pstdio",
        main: "./extension.ts",
        engines: { pstdio: EXTENSION_API_VERSION },
      }),
    );
    writeFileSync(
      join(root, "extension.ts"),
      `export default {
        commands: [
          {
            id: "sayHello",
            ref: { kind: "command", id: "sayHello" },
            title: { $l10n: "commands.sayHello.title", default: "Say hello" },
            run: async () => undefined,
          },
        ],
        translations: {
          fr: { kind: "package-asset", path: "./fr.json", baseUrl: import.meta.url },
        },
      };`,
    );

    try {
      const response = await createApp(root).request("/v1/projects/project-1/extensions/appearance");
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.translations).toEqual([
        {
          extensionId: "pstdio.lab",
          defaultLocale: "en",
          bundles: {
            en: { "commands.sayHello.title": "Say hello" },
            fr: { "commands.sayHello.title": "Dire bonjour" },
          },
        },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("returns contract-shaped theme records with top-level tokens", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-appearance-route-"));
    writeFileSync(
      join(root, "theme.json"),
      JSON.stringify({
        colors: {
          "badge.background": "#49483e",
          "badge.foreground": "#f8f8f2",
          "diffEditor.insertedTextBackground": "#a6e22e26",
          "diffEditor.removedTextBackground": "#f9267226",
          "editor.background": "#272822",
          "editor.foreground": "#f8f8f2",
          "gitDecoration.addedResourceForeground": "#a6e22e",
          "gitDecoration.deletedResourceForeground": "#f92672",
          "list.activeSelectionBackground": "#6f6b57",
          "list.hoverBackground": "#4b4a3f",
        },
      }),
    );
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        name: "lab",
        version: "1.0.0",
        displayName: "Lab",
        publisher: "pstdio",
        main: "./extension.ts",
        engines: { pstdio: EXTENSION_API_VERSION },
      }),
    );
    writeFileSync(
      join(root, "extension.ts"),
      `export default {
        themes: [
          {
            id: "monokai",
            ref: { kind: "theme", id: "monokai" },
            title: "Monokai",
            format: "vscode-color-theme",
            mode: "dark",
            source: { kind: "package-asset", path: "./theme.json", baseUrl: import.meta.url },
          },
        ],
      };`,
    );

    try {
      const response = await createApp(root).request("/v1/projects/project-1/extensions/appearance");
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.themes[0]).toMatchObject({
        id: "pstdio.lab.theme.monokai",
        title: "Monokai",
        tokens: {
          "colors.bg": "#272822",
          "colors.bg.error": "#f9267226",
          "colors.bg.menu-item.focus": "#4b4a3f",
          "colors.bg.menu-item.hover": "#4b4a3f",
          "colors.bg.menu-item.selected": "#6f6b57",
          "colors.bg.muted": "#49483e",
          "colors.bg.success": "#a6e22e26",
          "colors.fg": "#f8f8f2",
          "colors.fg.error": "#f92672",
          "colors.fg.muted": "#f8f8f2",
          "colors.fg.success": "#a6e22e",
          "colors.vscode.badge.background": "#49483e",
          "colors.vscode.editor.background": "#272822",
          "colors.vscode.editor.foreground": "#f8f8f2",
          "colors.vscode.list.activeSelectionBackground": "#6f6b57",
          "colors.vscode.list.hoverBackground": "#4b4a3f",
        },
      });
      expect(body.themes[0].preference).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
