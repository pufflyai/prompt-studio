import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createWorkbenchExtensionMetadata } from "../../workbench/metadata/workbench-extension-metadata";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const packagePath = resolve(import.meta.dir, "../../../../../extensions/extension-lab");

for (const name of ["scribble", "boombox", "zipline", "pigeon", "kiln"]) {
  test(`the documented ${name} example normalizes into host contributions`, async () => {
    const sourcePath = resolve(packagePath, `src/examples/${name}.ts`);
    const { default: definition } = await import(pathToFileURL(sourcePath).href);
    const source: LoadedExtensionSource = {
      packagePath,
      sourcePath,
      sourceKind: "local_path",
      definition,
      manifest: {
        id: "pstdio.extension-lab",
        name: "extension-lab",
        publisher: "pstdio",
        version: "1.0.0",
        main: "./extension.ts",
        enginesPstdio: EXTENSION_API_VERSION,
      },
    };
    const runtime = normalizeExtensionSources([source]);
    expect(runtime.diagnostics).toEqual([]);
    const metadata = createWorkbenchExtensionMetadata({
      runtime,
      resolveWebview: ({ webview }) => ({
        ...webview,
        capabilities: [],
        runtimeUrl: "/runtime.js",
        moduleUrl: "/view.js",
      }),
    });
    expect(metadata.modes[0].defaultTheme).toMatchObject({
      extensionId: "pstdio.extension-lab",
      kind: "theme",
      id: name,
    });
    expect(runtime.themes).toHaveLength(1);
    expect(metadata.resourceKinds).toHaveLength(1);
    const home = metadata.pages.find((page) => page.localId === name)!;
    const detail = metadata.pages.find((page) => page.localId === `${name}-resource`)!;
    expect(home.slots.find((slot) => slot.role === "primary")).toMatchObject({ view: expect.any(Object) });
    expect(detail.slots.find((slot) => slot.role === "primary")).toMatchObject({ binding: expect.any(Object) });
    expect(detail.parent).toEqual({ extensionId: "pstdio.extension-lab", kind: "page", id: name });
    expect(metadata.views.length).toBeGreaterThanOrEqual(2);
    expect(metadata.navigationItems[0].action).toMatchObject({
      kind: "page",
      page: {
        extensionId: "pstdio.extension-lab",
        id: ["scribble", "boombox", "kiln"].includes(name) ? `${name}-resource` : name,
      },
    });
  });
}
