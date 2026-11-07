import { expect, test } from "bun:test";
import { defineExtension, defineView } from "@pstdio/sdk/extensions";
import { EXTENSION_API_VERSION, workbenchExtensionViewRecordSchema } from "pstdio-api-contracts";
import { createWorkbenchExtensionMetadata } from "../../workbench/metadata/workbench-extension-metadata";
import { checkExtensionHostCompatibility, dashboardExtensionHostCapabilities } from "../host-capabilities";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const source = (body: unknown): LoadedExtensionSource => ({
  packagePath: "/fake/console",
  sourcePath: "/fake/console/extension.ts",
  sourceKind: "local_path",
  manifest: {
    id: "example.console",
    name: "console",
    publisher: "example",
    version: "1.0.0",
    main: "./extension.ts",
    enginesPstdio: `^${EXTENSION_API_VERSION}`,
  },
  definition: defineExtension({ views: [defineView({ id: "shell", title: "Shell", body: body as never })] }),
});

test("terminal views normalize a host callback and serialize no process handles", () => {
  const session = () => ({ command: ["sh"], env: { TOOL: "console" }, workspaceId: "workspace" });
  const runtime = normalizeExtensionSources([source({ kind: "terminal", session })]);
  expect(runtime.diagnostics).toEqual([]);
  expect(runtime.privateHandlers).toMatchObject([
    {
      id: "example.console.view.shell.terminal.session",
      rendererKind: "terminal",
      operation: "session",
      handler: session,
    },
  ]);
  const record = createWorkbenchExtensionMetadata({ runtime }).views[0];
  expect(record).toMatchObject({
    body: { kind: "terminal", sessionHandlerId: "example.console.view.shell.terminal.session" },
  });
  expect(workbenchExtensionViewRecordSchema.parse(JSON.parse(JSON.stringify(record)))).toEqual(record);
  expect(JSON.stringify(record)).not.toContain("command");
  expect(checkExtensionHostCompatibility(runtime, dashboardExtensionHostCapabilities).diagnostics).toEqual([]);
  const { "view.terminal.v1": _terminal, ...capabilities } = dashboardExtensionHostCapabilities.capabilities;
  expect(
    checkExtensionHostCompatibility(runtime, { ...dashboardExtensionHostCapabilities, capabilities }).diagnostics,
  ).toContainEqual(
    expect.objectContaining({
      code: "extension_host_capability_missing",
      metadata: expect.objectContaining({ missingCapability: "view.terminal.v1" }),
    }),
  );
});

test("terminal declarations reject process handles and missing callbacks", () => {
  for (const body of [{ kind: "terminal" }, { kind: "terminal", session: () => ({}), handle: {} }]) {
    const runtime = normalizeExtensionSources([source(body)]);
    expect(runtime.views).toEqual([]);
    expect(runtime.diagnostics.some((diagnostic) => diagnostic.severity === "error")).toBe(true);
  }
});
