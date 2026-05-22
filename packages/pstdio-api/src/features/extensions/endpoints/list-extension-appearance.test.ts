import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { createExtensionRoutes } from "../routes";

const createApp = (sourcePath: string) => {
  const app = new OpenAPIHono();
  app.route(
    "/v1",
    createExtensionRoutes({
      extensionService: {
        listEnabledSourcesForProject: async () => [
          {
            instance: { namespace: "lab" },
            installedSource: {
              extension_id: "pstdio.lab",
              source_kind: "local",
              source_path: sourcePath,
            },
          },
        ],
      },
    } as never),
  );
  return app;
};

describe("list extension appearance", () => {
  test("returns contract-shaped theme records with top-level tokens", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-appearance-route-"));
    writeFileSync(
      join(root, "theme.json"),
      JSON.stringify({ colors: { "editor.background": "#272822", "editor.foreground": "#f8f8f2" } }),
    );
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        name: "lab",
        version: "1.0.0",
        displayName: "Lab",
        publisher: "pstdio",
        main: "./extension.ts",
        engines: { pstdio: "^1.0.0" },
      }),
    );
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
      };`,
    );

    try {
      const response = await createApp(root).request("/v1/projects/project-1/extensions/appearance");
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.themes[0]).toMatchObject({
        id: "lab.monokai",
        title: "Monokai",
        tokens: {
          "colors.bg": "#272822",
          "colors.fg": "#f8f8f2",
          "colors.vscode.editor.background": "#272822",
          "colors.vscode.editor.foreground": "#f8f8f2",
        },
      });
      expect(body.themes[0].preference).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
