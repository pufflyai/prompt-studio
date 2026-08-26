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
    enginesPstdio: "1.0.0-alpha.4",
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
            defineMode({ id: "good", label: "Good", icon: "flask-conical" }),
            defineMode({ id: "also-good", label: "Also good", icon: "FileText" }),
            defineMode({ id: "bad", label: "Bad", icon: "definitely-not-an-icon" }),
          ],
        }),
      ),
    ]);

    const diagnostics = collectConventionDiagnostics(runtime).filter((item) => item.code === "extension_icon_unknown");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.metadata).toMatchObject({ icon: "definitely-not-an-icon" });
  });

  test("flags mixed contribution id casing and dotted local ids", () => {
    const runtime = normalizeExtensionSources([
      wrap(
        "planner",
        defineExtension({
          commands: [
            defineCommand({ id: "create-ticket", title: "Create", async run() {} }),
            defineCommand({ id: "ticketStatus.create", title: "Create status", async run() {} }),
          ],
        }),
      ),
    ]);

    const reasons = collectConventionDiagnostics(runtime)
      .filter((item) => item.code === "extension_contribution_id_casing")
      .map((item) => item.metadata?.reason)
      .sort();
    expect(reasons).toEqual(["dotted-local-id", "mixed-casing"]);
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
