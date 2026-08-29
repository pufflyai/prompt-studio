import { describe, expect, test } from "bun:test";
import type {
  ContributionKind,
  ExtensionDefinition,
  WebviewCapabilityDeclaration,
} from "pstdio-api-contracts/extension-kernel";
import { type LoadedExtensionSource, normalizeExtensionSources } from "pstdio-extensions";
import { createExtensionWebviewAccess } from "./extension-webview-access";
import {
  type BuildWorkbenchExtensionMetadataInput,
  buildWorkbenchExtensionMetadata as buildMetadata,
} from "./workbench-extension-metadata";

const webviewUrlIssuer = createExtensionWebviewAccess({ signingKey: Buffer.from("test-webview-signing-key") });

const buildWorkbenchExtensionMetadata = (input: Omit<BuildWorkbenchExtensionMetadataInput, "webviewUrlIssuer">) =>
  buildMetadata({ ...input, webviewUrlIssuer });

const defineContribution = <const Kind extends ContributionKind, Definition extends { id: string }>(
  kind: Kind,
  definition: Definition,
) => ({ ...definition, ref: { kind, id: definition.id } });

const defineCommand = <Definition extends { id: string }>(definition: Definition) =>
  defineContribution("command", definition);
const defineKeybinding = <Definition extends { id: string }>(definition: Definition) =>
  defineContribution("keybinding", definition);
const defineMode = <Definition extends { id: string }>(definition: Definition) =>
  defineContribution("mode", definition);
const definePlacement = <Definition extends { id: string }>(definition: Definition) =>
  defineContribution("placement", definition);
const defineView = <Definition extends { id: string }>(definition: Definition) =>
  defineContribution("view", definition);
const defineExtension = <const Definition extends ExtensionDefinition>(definition: Definition) => definition;
const packageAsset = (path: string, baseUrl: string) => ({ kind: "package-asset" as const, path, baseUrl });
const projectMode = { extensionId: "pstdio", kind: "mode" as const, id: "project" };

const source = (definition: LoadedExtensionSource["definition"]): LoadedExtensionSource => ({
  sourcePath: "/extension/extension.ts",
  sourceKind: "local_path" as const,
  packagePath: "/extension",
  manifest: {
    id: "pstdio.lab",
    name: "lab",
    displayName: "Lab",
    description: "Lab extension for dashboard experiments.",
    version: "1.0.0",
    publisher: "pstdio",
    main: "./extension.ts",
    enginesPstdio: "1.0.0-alpha.4",
  },
  definition,
});

const webviewRuntime = (entryPath: string, capabilities?: WebviewCapabilityDeclaration[]) => {
  const view = defineView({
    id: "page",
    title: "Lab",
    path: "lab",
    body: {
      kind: "webview" as const,
      entry: packageAsset(entryPath, "file:///extension/extension.ts"),
      capabilities,
    },
  });
  return normalizeExtensionSources([
    source(
      defineExtension({
        views: [view],
        placements: [
          definePlacement({
            id: "page.project",
            mode: projectMode,
            item: { kind: "view", view: view.ref },
            region: "main",
          }),
        ],
      }),
    ),
  ]);
};

describe("buildWorkbenchExtensionMetadata", () => {
  test("publishes extension identity and typed mode identity", () => {
    const mode = defineMode({ id: "review", label: "Review", icon: "message-circle" });
    const metadata = buildWorkbenchExtensionMetadata({
      installNamesByExtensionId: new Map(),
      runtime: normalizeExtensionSources([source(defineExtension({ modes: [mode] }))]),
      webviewCacheRoot: "/cache",
    });

    expect(metadata.extensions[0]?.description).toBe("Lab extension for dashboard experiments.");
    expect(metadata.modes[0]).toEqual({
      id: "pstdio.lab.mode.review",
      localId: "review",
      extensionId: "pstdio.lab",
      label: "Review",
      icon: "message-circle",
    });
  });

  test("publishes the project extension owner with each extension", () => {
    const metadata = buildWorkbenchExtensionMetadata({
      extensionInstanceIdsByExtensionId: new Map([["pstdio.lab", "instance-1"]]),
      installedExtensionIdsByExtensionId: new Map([["pstdio.lab", "installed-1"]]),
      installNamesByExtensionId: new Map([["pstdio.lab", "extension-lab"]]),
      runtime: normalizeExtensionSources([source(defineExtension({}))]),
      webviewCacheRoot: "/cache",
    });

    expect(metadata.extensions[0]).toMatchObject({
      extensionInstanceId: "instance-1",
      installedExtensionId: "installed-1",
      installName: "extension-lab",
    });
  });

  test("adds signed bridge URLs and preserves capabilities on managed webview bodies", () => {
    const metadata = buildWorkbenchExtensionMetadata({
      assetRevisionsByExtensionId: new Map([["pstdio.lab", "build-2"]]),
      installNamesByExtensionId: new Map([["pstdio.lab", "extension-lab"]]),
      runtime: webviewRuntime("./src/main.tsx", ["commands.execute", "preferences.set@1"]),
      webviewCacheRoot: "/cache",
    });

    const view = metadata.views[0];
    expect(view).toMatchObject({ id: "pstdio.lab.view.page", localId: "page", path: "lab" });
    expect(view?.body.kind).toBe("webview");
    if (view?.body.kind !== "webview") throw new Error("Expected a webview body");
    const basePath = webviewUrlIssuer
      .runtimeUrl({ installName: "extension-lab", webviewId: "pstdio.lab.view.page" })
      .replace(/\/runtime$/, "");
    expect(view.body.webview.runtimeUrl).toBe(`${basePath}/runtime`);
    expect(view.body.webview.moduleUrl).toBe(`${basePath}/assets/module.js?h=build-2`);
    expect(view.body.webview.capabilities).toEqual(["commands.execute", "preferences.set@1"]);
  });

  test("keeps native callback and typed command metadata on the view body", () => {
    const restart = defineCommand({ id: "restart", title: "Restart rows", async run() {} });
    const services = defineView({
      id: "services",
      title: "Services",
      body: {
        kind: "dataTable" as const,
        columns: [] as never[],
        query: async () => ({ rows: [] }),
        selectionMode: "multiple" as const,
        selectionActions: [{ id: "restart", label: "Restart selected", command: restart.ref }],
      },
    });
    const metadata = buildWorkbenchExtensionMetadata({
      installNamesByExtensionId: new Map(),
      runtime: normalizeExtensionSources([
        source(
          defineExtension({
            commands: [restart],
            views: [services],
            keybindings: [defineKeybinding({ id: "restart", key: "mod+shift+r", command: restart.ref })],
          }),
        ),
      ]),
      webviewCacheRoot: "/cache",
    });

    expect(metadata.views[0]?.body).toMatchObject({
      kind: "dataTable",
      queryHandlerId: "pstdio.lab.view.services.dataTable.query",
      selectionActions: [
        {
          id: "restart",
          label: "Restart selected",
          command: { extensionId: "pstdio.lab", kind: "command", id: "restart" },
        },
      ],
    });
    expect(metadata.keybindings?.[0]).toMatchObject({
      commandId: "pstdio.lab.command.restart",
      canonicalChord: "Mod+Shift+R",
    });
    expect(metadata).not.toHaveProperty("dataTableRenderers");
  });

  test("does not emit unsupported html webviews", () => {
    const metadata = buildWorkbenchExtensionMetadata({
      installNamesByExtensionId: new Map([["pstdio.lab", "extension-lab"]]),
      runtime: webviewRuntime("./static.html"),
      webviewCacheRoot: "/cache",
    });

    expect(metadata.views).toEqual([]);
  });
});
