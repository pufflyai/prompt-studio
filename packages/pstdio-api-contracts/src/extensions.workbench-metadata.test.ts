import { describe, expect, test } from "bun:test";
import { workbenchExtensionMetadataSchema } from "./extensions";

const ref = <Kind extends string>(kind: Kind, id: string) => ({ extensionId: "pstdio.lab", kind, id });

const metadata = () => ({
  extensions: [{ id: "pstdio.lab", name: "lab", displayName: "Lab", sourcePath: "/extensions/lab" }],
  commands: [{ id: "pstdio.lab.command.review", extensionId: "pstdio.lab", title: "Review" }],
  menuContributions: [],
  modes: [{ id: "pstdio.lab.mode.project", localId: "project", extensionId: "pstdio.lab", label: "Lab" }],
  views: [
    {
      id: "pstdio.lab.view.files",
      localId: "files",
      extensionId: "pstdio.lab",
      title: "Files",
      path: "/files",
      body: { kind: "tree", bodyHandlerId: "pstdio.lab.private.tree.files.body" },
    },
  ],
  viewMenus: [],
  placements: [
    {
      id: "pstdio.lab.placement.files",
      localId: "files",
      extensionId: "pstdio.lab",
      mode: ref("mode", "project"),
      item: { kind: "view", view: ref("view", "files") },
      region: "main",
      required: true,
    },
  ],
  resourceKinds: [],
  resourceViews: [],
  navigationItems: [
    {
      id: "pstdio.lab.navigation-item.files",
      extensionId: "pstdio.lab",
      slot: ref("navigation-item", "project"),
      label: "Files",
      action: { kind: "view", view: ref("view", "files") },
    },
  ],
  statusBarItems: [],
  statuses: [],
  settingsPanels: [],
  diagnostics: [],
});

describe("workbench extension metadata", () => {
  test("keeps views, placement, and navigation as separate typed records", () => {
    const parsed = workbenchExtensionMetadataSchema.parse(metadata());

    expect(parsed.views[0]).toMatchObject({
      id: "pstdio.lab.view.files",
      path: "/files",
      body: { kind: "tree", bodyHandlerId: "pstdio.lab.private.tree.files.body" },
    });
    expect(parsed.placements[0]).toMatchObject({
      mode: ref("mode", "project"),
      item: { kind: "view", view: ref("view", "files") },
      region: "main",
    });
    expect(parsed.navigationItems[0]?.action).toEqual({ kind: "view", view: ref("view", "files") });
    expect(parsed).not.toHaveProperty("panels");
    expect(parsed).not.toHaveProperty("treeRenderers");
    expect(parsed).not.toHaveProperty("routes");
  });

  test("rejects an alpha.3 panel payload", () => {
    const legacy = { ...metadata(), panels: [{ id: "files" }] };
    const parsed = workbenchExtensionMetadataSchema.strict().safeParse(legacy);

    expect(parsed.success).toBe(false);
  });
});
