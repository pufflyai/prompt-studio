import { describe, expect, test } from "bun:test";
import {
  defineCommand,
  defineExtension,
  defineMode,
  defineNavigationItem,
  definePlacement,
  defineView,
  packageAsset,
  workbenchModes,
  workbenchSlots,
} from "@pstdio/sdk/extensions";
import { collectConventionDiagnostics } from "./conventions";
import type { LoadedExtensionSource } from "./loader";
import { normalizeExtensionSources } from "./normalize";

const wrap = (name: string, definition: LoadedExtensionSource["definition"]): LoadedExtensionSource => ({
  packagePath: `/fake/${name}`,
  sourcePath: `/fake/${name}/extension.ts`,
  sourceKind: "local_path",
  manifest: {
    id: `pstdio.${name}`,
    name,
    version: "1.0.0",
    publisher: "pstdio",
    main: "./extension.ts",
    enginesPstdio: "1.0.0-alpha.7",
  },
  definition,
});

describe("extension convention diagnostics", () => {
  test("flags unknown icon names", () => {
    const runtime = normalizeExtensionSources([
      wrap(
        "lab",
        defineExtension({
          modes: [
            defineMode({ id: "good", label: "Good", icon: "flask-conical", regions: ["main"] }),
            defineMode({ id: "also-good", label: "Also good", icon: "FileText", regions: ["main"] }),
            defineMode({ id: "bad", label: "Bad", icon: "definitely-not-an-icon", regions: ["main"] }),
          ],
        }),
      ),
    ]);

    const diagnostics = collectConventionDiagnostics(runtime).filter((item) => item.code === "extension_icon_unknown");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.metadata).toMatchObject({ icon: "definitely-not-an-icon" });
  });

  test("accepts dotted kebab-case local ids", () => {
    const runtime = normalizeExtensionSources([
      wrap(
        "planner",
        defineExtension({
          commands: [
            defineCommand({ id: "create-ticket", title: "Create", async run() {} }),
            defineCommand({ id: "ticket-status.create", title: "Create status", async run() {} }),
          ],
        }),
      ),
    ]);

    const diagnostics = collectConventionDiagnostics(runtime).filter(
      (item) => item.code === "extension_contribution_id_invalid",
    );
    expect(diagnostics).toEqual([]);
  });

  test("rejects camelCase and snake_case local ids with the grammar", () => {
    const runtime = normalizeExtensionSources([
      wrap(
        "planner",
        defineExtension({
          commands: [
            defineCommand({ id: "ticketStatus.create", title: "Create status", async run() {} }),
            defineCommand({ id: "use_reports", title: "Use reports", async run() {} }),
          ],
        }),
      ),
    ]);

    const diagnostics = collectConventionDiagnostics(runtime).filter(
      (item) => item.code === "extension_contribution_id_invalid",
    );
    expect(diagnostics.map((item) => item.severity)).toEqual(["error", "error"]);
    expect(diagnostics.map((item) => item.metadata?.invalidId).sort()).toEqual(["ticketStatus.create", "use_reports"]);
    expect(diagnostics[0]?.message).toContain("kebab-case");
  });

  test("flags dangling typed command and view references", () => {
    const view = defineView({
      id: "existing",
      title: "Existing",
      body: { kind: "webview", entry: packageAsset("./existing.tsx", "file:///fake/lab/") },
    });
    const runtime = normalizeExtensionSources([
      wrap(
        "lab",
        defineExtension({
          views: [view],
          navigationItems: [
            defineNavigationItem({
              id: "dangling-command",
              slot: workbenchSlots.projectNavigation,
              label: "Dangling command",
              action: { kind: "command", target: { command: { kind: "command", id: "missing" } } },
            }),
          ],
          placements: [
            definePlacement({
              id: "dangling-view",
              mode: workbenchModes.project,
              item: { kind: "view", view: { kind: "view", id: "missing" } },
              region: "main",
            }),
          ],
        }),
      ),
    ]);

    expect(collectConventionDiagnostics(runtime)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "extension_command_reference_missing",
          metadata: expect.objectContaining({ failedReference: "pstdio.lab.command.missing" }),
        }),
        expect.objectContaining({
          code: "extension_view_reference_missing",
          metadata: expect.objectContaining({ failedReference: "pstdio.lab.view.missing" }),
        }),
      ]),
    );
  });
});
