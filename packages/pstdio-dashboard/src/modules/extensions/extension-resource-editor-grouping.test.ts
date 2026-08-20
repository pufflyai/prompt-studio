import { describe, expect, test } from "bun:test";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { groupResourceEditorViews } from "./extension-resource-editor-grouping";

type ExtensionPanelRecord = DashboardExtensionMetadata["panels"][number];
type ExtensionRegion = ExtensionPanelRecord["supportedRegions"][number];

const panel = (id: string, region: ExtensionRegion = "main"): ExtensionPanelRecord =>
  ({
    id,
    extensionId: "ext",
    title: id,
    supportedRegions: [region],
    webview: { entry: { kind: "package-asset", path: `./${id}.tsx`, baseUrl: "file:///ext/extension.ts" } },
  }) as ExtensionPanelRecord;

const edge = (resourceKind: string, panelId: string, slot: string) => ({
  id: `${resourceKind}.${slot}`,
  extensionId: "ext",
  resourceKind,
  panel: panelId,
  slot,
});

const kind = (id: string, slots: string[]) => ({
  id,
  extensionId: "ext",
  surface: "primary" as const,
  slots: Object.fromEntries(slots.map((slot) => [slot, { cardinality: "one" as const, external: false }])),
});

const metadata = (input: Partial<DashboardExtensionMetadata>) =>
  ({ ...emptyDashboardExtensionMetadata, ...input }) as DashboardExtensionMetadata;

describe("groupResourceEditorViews", () => {
  test("pairs the main editor with companion panels bound to the same resource kind", () => {
    const groups = groupResourceEditorViews(
      metadata({
        panels: [panel("properties", "secondary"), panel("editor")],
        resourceKinds: [kind("ticket", ["primary", "properties"])],
        resourcePanels: [edge("ticket", "properties", "properties"), edge("ticket", "editor", "primary")],
        modes: [
          {
            id: "ext.ticket",
            extensionId: "ext",
            modeId: "ext.ticket",
            label: "Ticket",
            resources: {
              ticket: { slots: { primary: { region: "main" }, properties: { region: "secondary" } } },
            },
          },
        ],
      }),
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.kind).toBe("ticket");
    // The panel the recipe puts in `main` is primary even when it is declared later.
    expect(groups[0]?.primary?.panel.id).toBe("editor");
    expect(groups[0]?.companions.map((companion) => companion.panel.id)).toEqual(["properties"]);
  });

  test("uses the mode recipe region, not the panel's declaration order, to pick the editor", () => {
    const groups = groupResourceEditorViews(
      metadata({
        panels: [panel("files", "sidenav"), panel("editor")],
        resourceKinds: [kind("ticket", ["primary", "files"])],
        resourcePanels: [edge("ticket", "files", "files"), edge("ticket", "editor", "primary")],
        modes: [
          {
            id: "ext.ticket",
            extensionId: "ext",
            modeId: "ext.ticket",
            label: "Ticket",
            resources: { ticket: { slots: { primary: { region: "main" }, files: { region: "sidenav" } } } },
          },
        ],
      }),
    );

    expect(groups[0]?.primary?.panel.id).toBe("editor");
    expect(groups[0]?.companions.map((companion) => companion.panel.id)).toEqual(["files"]);
  });

  test("groups side-only kinds as inspector groups without a primary", () => {
    const groups = groupResourceEditorViews(
      metadata({
        panels: [panel("detail", "side")],
        resourceKinds: [kind("artifact", ["detail"])],
        resourcePanels: [edge("artifact", "detail", "detail")],
      }),
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.kind).toBe("artifact");
    expect(groups[0]?.primary).toBeUndefined();
    expect(groups[0]?.companions.map((companion) => companion.panel.id)).toEqual(["detail"]);
  });

  test("drops kinds with neither a main nor a side panel", () => {
    const groups = groupResourceEditorViews(
      metadata({
        panels: [panel("files", "sidenav")],
        resourceKinds: [kind("artifact", ["files"])],
        resourcePanels: [edge("artifact", "files", "files")],
      }),
    );

    expect(groups).toHaveLength(0);
  });

  test("keeps resource kinds independent and ignores panels with no edge", () => {
    const groups = groupResourceEditorViews(
      metadata({
        panels: [panel("ticket-editor"), panel("session-editor"), panel("overview")],
        resourceKinds: [kind("ticket", ["primary"]), kind("session", ["primary"])],
        resourcePanels: [edge("ticket", "ticket-editor", "primary"), edge("session", "session-editor", "primary")],
      }),
    );

    expect(groups.map((group) => group.kind).sort()).toEqual(["session", "ticket"]);
    expect(groups.every((group) => group.companions.length === 0)).toBe(true);
  });
});
