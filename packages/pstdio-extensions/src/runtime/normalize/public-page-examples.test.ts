import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createWorkbenchExtensionMetadata } from "../../workbench/metadata/workbench-extension-metadata";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const packagePath = resolve(import.meta.dir, "../../../../../extensions/extension-lab");

for (const name of ["commands", "scribble", "zipline", "pigeon"]) {
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
    const metadata = createWorkbenchExtensionMetadata({ runtime });
    if (name === "commands") {
      expect(metadata.commands).toHaveLength(2);
      expect(metadata.resourceKinds).toHaveLength(1);
    } else {
      expect(metadata.pages).toHaveLength(1);
      expect(metadata.views).toHaveLength(2);
      expect(metadata.navigationItems[0].action).toMatchObject({
        kind: "page",
        page: { extensionId: "pstdio.extension-lab", id: name },
      });
    }
  });
}
