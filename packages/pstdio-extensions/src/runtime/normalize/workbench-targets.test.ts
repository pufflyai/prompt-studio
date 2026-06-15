import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const wrap = (definition: ReturnType<typeof defineExtension>): LoadedExtensionSource => ({
  packagePath: "/fake/lab",
  sourcePath: "/fake/lab/extension.ts",
  sourceKind: "local_path",
  manifest: {
    id: "pstdio.lab",
    name: "lab",
    version: "1.0.0",
    publisher: "pstdio",
    main: "./extension.ts",
    enginesPstdio: "^1.0.0",
  },
  definition,
});

describe("normalizeExtensionSources workbench targets", () => {
  test("keeps target-authored menus, tree items, and settings panels", () => {
    const lab = defineExtension({
      commands: {
        review: {
          title: "Review",
          menus: [
            {
              target: "workbench.nav.actions",
              label: "Review",
              when: { mode: "workspace", resourceType: ["workspace"] },
            },
          ],
          run: async () => undefined,
        },
      },
      treeItems: {
        workspaceOnly: {
          target: "workbench.left.tree",
          label: "Workspace only",
          action: { kind: "route", route: "workspace-lab" },
          when: { mode: "workspace" },
        },
      },
      settingsPanels: {
        projectPanel: {
          target: "workbench.settings",
          scope: "project",
          title: "Project panel",
          icon: "tag",
          webview: { entry: packageAsset("./settings.tsx", "file:///fake/lab/extension.ts") },
        },
      },
    });

    const runtime = normalizeExtensionSources([wrap(lab)]);

    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.commands[0]?.menus[0]).toMatchObject({
      target: "workbench.nav.actions",
      when: { mode: "workspace", resourceType: ["workspace"] },
    });
    expect(runtime.treeItems[0]?.contribution).toMatchObject({
      target: "workbench.left.tree",
      when: { mode: "workspace" },
    });
    expect(runtime.settingsPanels[0]?.contribution).toMatchObject({
      target: "workbench.settings",
      scope: "project",
      icon: "tag",
    });
  });

  test("diagnoses targets that are known but unsupported for the contribution kind", () => {
    const lab = defineExtension({
      commands: {
        review: {
          title: "Review",
          menus: [{ target: "workbench.left.tree" as never, label: "Wrong target" }],
          run: async () => undefined,
        },
      },
    });

    const runtime = normalizeExtensionSources([wrap(lab)]);

    expect(runtime.commands[0]?.menus).toEqual([]);
    expect(runtime.diagnostics).toEqual([
      expect.objectContaining({
        code: "extension_target_unsupported",
        extensionId: "pstdio.lab",
        metadata: expect.objectContaining({
          contributionId: "lab.review.menus[0]",
          expectedKind: "menu",
          target: "workbench.left.tree",
        }),
      }),
    ]);
  });

  test("diagnoses tree items without a target", () => {
    const lab = defineExtension({
      treeItems: {
        missingTarget: {
          label: "Missing target",
          action: { kind: "route", route: "lab" },
        } as never,
      },
    });

    const runtime = normalizeExtensionSources([wrap(lab)]);

    expect(runtime.treeItems).toEqual([]);
    expect(runtime.diagnostics).toEqual([
      expect.objectContaining({
        code: "extension_target_invalid",
        extensionId: "pstdio.lab",
        metadata: expect.objectContaining({
          contributionId: "lab.missingTarget",
          expectedKind: "treeItem",
        }),
      }),
    ]);
  });
});

describe("bundled extension target migration", () => {
  test("does not import legacy slot constants from bundled extension entrypoints", () => {
    const extensionsRoot = join(import.meta.dir, "../../../../../extensions");
    const forbiddenSlotImport = /\b(projectSlots|workspaceSlots|sessionSlots|ticketSlots)\b/;
    const offenders = readdirSync(extensionsRoot)
      .map((entry) => join(extensionsRoot, entry, "extension.ts"))
      .filter((entrypoint) => existsSync(entrypoint))
      .filter((entrypoint) => forbiddenSlotImport.test(readFileSync(entrypoint, "utf8")));

    expect(offenders).toEqual([]);
  });
});
