import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { loadExtensionSources } from "pstdio-extensions";
import { createExtensionWebviewAccess } from "../extension-webview-access";
import { createExtensionWebviewAssetRoutes } from "../extension-webview-asset-routes";
import { createProjectExtensionRuntimeCatalog } from "../project-extension-runtime-catalog";

export const webviewAccess = createExtensionWebviewAccess({
  signingKey: Buffer.from("test-webview-signing-key"),
});
export const webviewScope = { installedExtensionId: "installed-lab", webviewId: "pstdio.lab.view.labPage" };
export const webviewBasePath = webviewAccess.runtimeUrl(webviewScope).replace(/\/runtime$/, "");

export const writeExtension = (root: string, entry: string) => {
  mkdirSync(root, { recursive: true });
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "lab",
      version: "1.0.0",
      displayName: "Lab",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(join(root, "src", "main.tsx"), "console.log('managed');");
  writeFileSync(join(root, "static.html"), '<!doctype html><script src="./static.js"></script>');
  writeFileSync(join(root, "static.js"), "console.log('static');");
  writeFileSync(
    join(root, "extension.ts"),
    `export default {
      views: [{
        id: "labPage",
        ref: { kind: "view", id: "labPage" },
        title: "Lab",
        body: { kind: "webview", entry: { kind: "package-asset", path: "${entry}", baseUrl: import.meta.url } },
      }],
    };`,
  );
};

type SourceRow = { id: string; install_name: string; source_path: string; last_error_json?: unknown };

export const createApp = (input: {
  cacheRoot: string;
  sourcePath: string;
  lastErrorJson?: unknown;
  sources?: SourceRow[];
  failure?: string;
  onLoad?: () => void;
  ensureWebviews?: (installedExtensionId: string) => Promise<void>;
  onCatalog?: (catalog: ReturnType<typeof createProjectExtensionRuntimeCatalog>) => void;
}) => {
  const app = new OpenAPIHono();
  const extensionRuntimeCatalog = createProjectExtensionRuntimeCatalog({
    extensionService: {} as never,
    projectService: {} as never,
    workspaceService: { getDefault: async () => null } as never,
    loadSources: (options) => {
      input.onLoad?.();
      return loadExtensionSources(options);
    },
  });
  input.onCatalog?.(extensionRuntimeCatalog);
  app.route(
    "/v1",
    createExtensionWebviewAssetRoutes({
      ensureExtensionWebviews: input.ensureWebviews ?? (async () => {}),
      extensionRuntimeCatalog,
      extensionService: {
        getInstalledSourceById: async (id: string) => {
          if (input.failure) throw new Error(input.failure);
          const sources = input.sources ?? [
            {
              id: "installed-lab",
              install_name: "extension-lab",
              source_path: input.sourcePath,
              last_error_json: input.lastErrorJson,
            },
          ];
          const source = sources.find((candidate) => candidate.id === id);
          return source ? { ...source, source_kind: "local_path" } : null;
        },
      },
      extensionWebviewAccess: webviewAccess,
      webviewCacheRoot: input.cacheRoot,
    } as never),
  );
  app.all("*", (c) => c.text("session realm", 401));
  return app;
};
