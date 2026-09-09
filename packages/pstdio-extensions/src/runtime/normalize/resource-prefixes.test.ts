import { expect, test } from "bun:test";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const source = (name: string, prefix: unknown): LoadedExtensionSource => ({
  packagePath: `/fake/${name}`,
  sourcePath: `/fake/${name}/extension.ts`,
  sourceKind: "local_path",
  manifest: {
    id: `pstdio.${name}`,
    name,
    publisher: "pstdio",
    version: "1.0.0",
    main: "extension.ts",
    enginesPstdio: EXTENSION_API_VERSION,
  },
  definition: { resourceKinds: [{ id: name, ref: { kind: "resource-kind", id: name }, prefix: prefix as never }] },
});

test("resource prefixes reject malformed, reserved, and duplicate declarations", () => {
  for (const prefix of ["WS", "bad prefix", "", { $prefix: "unknown" }]) {
    expect(normalizeExtensionSources([source("first", prefix)]).diagnostics.some((d) => d.severity === "error")).toBe(
      true,
    );
  }
  for (const prefix of ["RP", { $prefix: "project" }]) {
    const runtime = normalizeExtensionSources([source("first", prefix), source("second", prefix)]);
    expect(runtime.diagnostics).toContainEqual(
      expect.objectContaining({ severity: "error", code: "extension_resource_prefix_duplicate" }),
    );
  }
  expect(
    normalizeExtensionSources([source("tickets", { $prefix: "project" }), source("reports", "RP")]).diagnostics,
  ).toEqual([]);
});
