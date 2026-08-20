import { describe, expect, test } from "bun:test";
import { normalizeExtensionSources } from "pstdio-extensions";
import { createExtensionWebviewAccess } from "./extension-webview-access";
import {
  type BuildWorkbenchExtensionMetadataInput,
  buildWorkbenchExtensionMetadata as buildWorkbenchExtensionMetadataWithAccess,
} from "./workbench-extension-metadata";

const webviewUrlIssuer = createExtensionWebviewAccess({ signingKey: Buffer.from("test-webview-signing-key") });
const buildWorkbenchExtensionMetadata = (input: Omit<BuildWorkbenchExtensionMetadataInput, "webviewUrlIssuer">) =>
  buildWorkbenchExtensionMetadataWithAccess({ ...input, webviewUrlIssuer });

describe("buildWorkbenchExtensionMetadata mode identity", () => {
  test("diagnoses duplicate extension mode ids and reserved host mode ids", () => {
    const source = (name: string, modeId: string) => ({
      sourcePath: `/extensions/${name}/extension.ts`,
      sourceKind: "local_path" as const,
      packagePath: `/extensions/${name}`,
      manifest: {
        id: `pstdio.${name}`,
        name,
        displayName: name,
        version: "1.0.0",
        publisher: "pstdio",
        main: "./extension.ts",
        enginesPstdio: "^1.0.0",
      },
      definition: {
        modes: {
          lab: { id: modeId, label: "Lab" },
        },
      },
    });
    const runtime = normalizeExtensionSources([
      source("one", "pstdio.lab.mode"),
      source("two", "pstdio.lab.mode"),
      source("three", "project"),
    ]);

    const metadata = buildWorkbenchExtensionMetadata({
      installNamesByExtensionId: new Map(),
      runtime,
      webviewCacheRoot: "/cache",
    });

    expect(metadata.modes.map((mode) => mode.modeId)).toEqual(["pstdio.lab.mode"]);
    expect(metadata.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "extension_mode_duplicate", extensionId: "pstdio.two" }),
        expect.objectContaining({ code: "extension_mode_duplicate", extensionId: "pstdio.three" }),
      ]),
    );
  });
});
