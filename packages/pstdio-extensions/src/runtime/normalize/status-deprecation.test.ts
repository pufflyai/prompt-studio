import { expect, test } from "bun:test";
import { defineExtension, defineStatuses } from "@pstdio/sdk/extensions";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

test("loads legacy status query and save handlers while warning about the replacement", async () => {
  const statuses = [{ id: "todo", label: "Todo", color: "blue", sortOrder: 0 }];
  const contribution = defineStatuses({
    id: "workflow",
    title: "Workflow",
    query: () => ({ statuses }),
    save: (_ctx, input) => input,
  });
  const source: LoadedExtensionSource = {
    packagePath: "/lab",
    sourcePath: "/lab/extension.ts",
    sourceKind: "local_path",
    manifest: {
      id: "acme.lab",
      name: "lab",
      publisher: "acme",
      version: "1.0.0",
      main: "./extension.ts",
      enginesPstdio: `^${EXTENSION_API_VERSION}`,
    },
    definition: defineExtension({ statuses: [contribution] }),
  };
  const runtime = normalizeExtensionSources([source]);
  expect(runtime.statuses).toHaveLength(1);
  const record = runtime.statuses[0]!;
  expect(record.contribution).toMatchObject({ queryHandlerId: expect.any(String), saveHandlerId: expect.any(String) });
  expect(await record.contribution.query({} as never, {})).toEqual({ statuses });
  expect(await record.contribution.save!({} as never, { statuses })).toEqual({ statuses });
  expect(runtime.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  expect(runtime.diagnostics).toContainEqual(
    expect.objectContaining({
      code: "deprecated_status_contribution",
      severity: "warning",
      extensionId: "acme.lab",
      sourcePath: source.sourcePath,
      metadata: { contributionId: record.id, capability: "status.v1" },
      message: expect.stringContaining("query-owned enum attributes"),
    }),
  );
});
