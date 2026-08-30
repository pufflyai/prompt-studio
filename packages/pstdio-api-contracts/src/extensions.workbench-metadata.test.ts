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
      body: { kind: "tree", bodyHandlerId: "pstdio.lab.private.tree.files.body" },
    },
  ],
  pages: [
    {
      id: "pstdio.lab.page.files",
      localId: "files",
      extensionId: "pstdio.lab",
      title: "Files",
      path: "files",
      slots: [{ id: "tree", region: "main", view: ref("view", "files"), closable: false }],
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
      action: { kind: "page", page: ref("page", "files") },
    },
  ],
  statusBarItems: [],
  statuses: [],
  settingsPanels: [],
  diagnostics: [],
});

describe("workbench extension metadata", () => {
  test("keeps views, pages, placement, and navigation as separate typed records", () => {
    const parsed = workbenchExtensionMetadataSchema.parse(metadata());

    expect(parsed.views[0]).toMatchObject({
      id: "pstdio.lab.view.files",
      body: { kind: "tree", bodyHandlerId: "pstdio.lab.private.tree.files.body" },
    });
    expect(parsed.pages?.[0]).toMatchObject({
      id: "pstdio.lab.page.files",
      path: "files",
      slots: [{ id: "tree", region: "main", closable: false }],
    });
    expect(parsed.placements[0]).toMatchObject({
      mode: ref("mode", "project"),
      item: { kind: "view", view: ref("view", "files") },
      region: "main",
    });
    expect(parsed.navigationItems[0]?.action).toEqual({ kind: "page", page: ref("page", "files") });
    expect(parsed).not.toHaveProperty("panels");
    expect(parsed).not.toHaveProperty("treeRenderers");
    expect(parsed).not.toHaveProperty("routes");
  });

  test("rejects an alpha.3 panel payload", () => {
    const legacy = { ...metadata(), panels: [{ id: "files" }] };
    const parsed = workbenchExtensionMetadataSchema.strict().safeParse(legacy);

    expect(parsed.success).toBe(false);
  });

  test("carries ordered template types and their provider commands", () => {
    const parsed = workbenchExtensionMetadataSchema.parse({
      ...metadata(),
      templateTypes: [
        {
          id: "pstdio.lab.template-type.report",
          localId: "report",
          extensionId: "pstdio.lab",
          label: "Report",
          order: 40,
          commands: {
            list: "pstdio.lab.command.templates.list",
            read: "pstdio.lab.command.templates.read",
            save: "pstdio.lab.command.templates.save",
            delete: "pstdio.lab.command.templates.delete",
          },
        },
      ],
    });

    expect(parsed.templateTypes?.[0]).toMatchObject({ label: "Report", order: 40 });
  });
});
