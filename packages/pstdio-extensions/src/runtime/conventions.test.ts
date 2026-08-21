import { describe, expect, test } from "bun:test";
import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";
import { collectConventionDiagnostics } from "./conventions";
import type { LoadedExtensionSource } from "./loader";
import { normalizeExtensionSources } from "./normalize";

const wrap = (name: string, definition: ReturnType<typeof defineExtension>): LoadedExtensionSource => ({
  packagePath: `/fake/${name}`,
  sourcePath: `/fake/${name}/extension.ts`,
  sourceKind: "local_path",
  manifest: {
    id: `pstdio.${name}`,
    name,
    version: "1.0.0",
    publisher: "pstdio",
    main: "./extension.ts",
    enginesPstdio: "^1.0.0",
  },
  definition,
});

describe("extension convention diagnostics", () => {
  test("flags unknown icon names and accepts kebab and pascal spellings of real icons", () => {
    const runtime = normalizeExtensionSources([
      wrap(
        "lab",
        defineExtension({
          modes: {
            good: { label: "Good", icon: "flask-conical" },
            alsoGood: { label: "Also good", icon: "FileText" },
            bad: { label: "Bad", icon: "definitely-not-an-icon" },
          },
        }),
      ),
    ]);

    const diagnostics = collectConventionDiagnostics(runtime).filter((d) => d.code === "extension_icon_unknown");

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.metadata).toMatchObject({ icon: "definitely-not-an-icon" });
    expect(diagnostics[0]?.severity).toBe("warning");
  });

  test("flags mixed contribution id casing and dotted local ids", () => {
    const runtime = normalizeExtensionSources([
      wrap(
        "planner",
        defineExtension({
          commands: {
            "create-ticket": { title: "Create", run: async () => undefined },
            "ticketStatus.create": { title: "Create status", run: async () => undefined },
          },
        }),
      ),
    ]);

    const diagnostics = collectConventionDiagnostics(runtime).filter(
      (d) => d.code === "extension_contribution_id_casing",
    );

    const reasons = diagnostics.map((d) => d.metadata?.reason).sort();
    expect(reasons).toEqual(["dotted-local-id", "mixed-casing"]);
  });

  test("flags command references that resolve to no registered command", () => {
    const runtime = normalizeExtensionSources([
      wrap(
        "lab",
        defineExtension({
          commands: {
            existing: { title: "Existing", run: async () => undefined },
          },
          treeItems: {
            ok: {
              target: "workbench.left.tree",
              label: "Ok",
              action: { kind: "command", command: "existing" },
            },
            hostOwned: {
              target: "workbench.left.tree",
              label: "Host",
              action: { kind: "command", command: "workbench.action.switchMode" },
            },
            dangling: {
              target: "workbench.left.tree",
              label: "Dangling",
              action: { kind: "command", command: "missing-command" },
            },
          },
        }),
      ),
    ]);

    const diagnostics = collectConventionDiagnostics(runtime).filter(
      (d) => d.code === "extension_command_reference_missing",
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.metadata).toMatchObject({ failedReference: "lab.missing-command" });
  });

  test("a clean extension produces no convention diagnostics", () => {
    const runtime = normalizeExtensionSources([
      wrap(
        "clean",
        defineExtension({
          commands: {
            "create-item": { title: "Create", run: async () => undefined },
          },
          panels: {
            "item-editor": {
              title: "Editor",
              show: { region: "main" },
              icon: "file-text",
              webview: { entry: packageAsset("./editor.tsx", import.meta.url) },
            },
          },
        }),
      ),
    ]);

    expect(collectConventionDiagnostics(runtime)).toEqual([]);
  });
});
