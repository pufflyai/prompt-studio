import { describe, expect, test } from "bun:test";
import type { ExtensionRuntime, RuntimeCliContribution, RuntimeCommandRecord } from "pstdio-extensions";
import { buildCliCollisionsReport, formatCollisionsReport } from "./collisions";

const cli = (
  partial: Partial<RuntimeCliContribution> & Pick<RuntimeCliContribution, "namespace" | "commandId" | "extensionId">,
): RuntimeCliContribution => ({
  path: partial.path ?? partial.commandId.split(".").slice(1),
  pathKey:
    partial.pathKey ?? `${partial.namespace} ${(partial.path ?? partial.commandId.split(".").slice(1)).join(" ")}`,
  ...partial,
});

const cmd = (extensionId: string, commandId: string, sourcePath: string): RuntimeCommandRecord =>
  ({
    id: commandId,
    localId: commandId.split(".").slice(1).join("."),
    extensionId,
    namespace: commandId.split(".")[0],
    sourcePath,
    title: commandId,
    params: {},
    commandPanel: {},
    menus: [],
    cli: undefined,
    run: async () => undefined,
  }) as RuntimeCommandRecord;

const baseRuntime = (): Pick<ExtensionRuntime, "commands" | "diagnostics" | "cli"> => ({
  commands: [],
  diagnostics: [],
  cli: [],
});

describe("collisions report", () => {
  test("static namespace collision is reported and refused", () => {
    const runtime = baseRuntime();
    runtime.cli.push(
      cli({ namespace: "tickets", extensionId: "acme.tickets", commandId: "tickets.list", path: ["list"] }),
    );
    runtime.commands.push(cmd("acme.tickets", "tickets.list", "/x/extension.ts"));

    const report = buildCliCollisionsReport(runtime, new Set(["tickets"]));

    expect(report.staticCollisions).toHaveLength(1);
    expect(report.staticCollisions[0]?.pathKey).toBe("tickets list");
    expect(report.refusedPathKeys.has("tickets list")).toBe(true);
    expect(report.blockedNamespaces.has("tickets")).toBe(true);

    const formatted = formatCollisionsReport(report);
    expect(formatted).toContain("cli_path_collision");
    expect(formatted).toContain("acme.tickets tickets.list");
    expect(formatted).toContain("Built-in");
    expect(formatted).toContain("tickets");
  });

  test("two extensions on the same CLI path are reported with both providers", () => {
    const runtime = baseRuntime();
    // First extension is "kept" (first to register).
    runtime.cli.push(
      cli({
        namespace: "lab",
        extensionId: "pstdio.extension-lab",
        commandId: "lab.counter.bump",
        path: ["counter", "bump"],
      }),
    );
    runtime.commands.push(cmd("pstdio.extension-lab", "lab.counter.bump", "/a/extension.ts"));

    // Second extension was rejected during normalize and emitted a diagnostic.
    runtime.commands.push(cmd("acme.other-lab", "lab.counter.bump", "/b/extension.ts"));
    runtime.diagnostics.push({
      code: "duplicate_cli_path",
      severity: "error",
      message: 'CLI path "lab counter bump" is already provided by lab.counter.bump',
      extensionId: "acme.other-lab",
      commandId: "lab.counter.bump",
      sourcePath: "/b/extension.ts",
    });

    const report = buildCliCollisionsReport(runtime, new Set());

    expect(report.duplicateCliPaths).toHaveLength(1);
    expect(report.duplicateCliPaths[0]?.providers.length).toBeGreaterThanOrEqual(2);
    expect(report.refusedPathKeys.has("lab counter bump")).toBe(true);

    const formatted = formatCollisionsReport(report);
    expect(formatted).toContain("duplicate_cli_path");
    expect(formatted).toContain("pstdio.extension-lab lab.counter.bump");
    expect(formatted).toContain("acme.other-lab lab.counter.bump");
  });
});
