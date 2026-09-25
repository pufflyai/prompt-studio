import { describe, expect, test } from "bun:test";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { NormalizedExtension } from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import { createAccumulator } from "./accumulator";
import { validateExtensionDefinition } from "./definition";

describe("extension contribution validation", () => {
  test.each([
    EXTENSION_API_VERSION,
    `${EXTENSION_API_VERSION} || 1.0.0-alpha.11`,
  ])("rejects removed contributions for a supported API declaration: %s", (enginesPstdio) => {
    const definition = { panels: [] } as unknown as LoadedExtensionSource["definition"];
    const source: LoadedExtensionSource = {
      packagePath: "/extension",
      sourcePath: "/extension/extension.ts",
      sourceKind: "local_path",
      manifest: {
        id: "test.compatible",
        name: "compatible",
        publisher: "test",
        version: "1.0.0",
        main: "./extension.ts",
        enginesPstdio,
      },
      definition,
    };
    const extension: NormalizedExtension = {
      ...source,
      id: source.manifest.id,
      name: source.manifest.name,
      displayName: source.manifest.name,
      version: source.manifest.version,
    };
    const runtime = createAccumulator([]);

    expect(validateExtensionDefinition(extension, source, runtime)).toBe(false);
    expect(runtime.diagnostics).toContainEqual(
      expect.objectContaining({ code: "removed_extension_contribution", metadata: { key: "panels" } }),
    );
  });
});
