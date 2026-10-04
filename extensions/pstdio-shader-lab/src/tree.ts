import { defineView, l10n, params } from "@pstdio/sdk/extensions";
import { commands } from "./commands";
import { listShaders } from "./configs";
import { shadersChanged } from "./events";
import { resource, target, versionId } from "./navigation";
import { shaders } from "./shaders/definitions";

// Deleting a shader's last version removes it from the lab; "Add shader" brings it back.
export const versionsTree = defineView({
  id: "versions",
  title: l10n("versions.title", "Shaders"),
  icon: "blend",
  body: {
    kind: "tree",
    refreshEvents: [shadersChanged],
    defaultExpandedNodeIds: shaders.map((shader) => shader.id),
    body: async (ctx, input) => {
      if (!ctx.projectFiles) throw new Error("Shader Lab needs a local project folder");
      const { projectId, resource: open } = input.renderer;
      const present = await listShaders(ctx.projectFiles);
      const missing = shaders.filter((shader) => !present.some((item) => item.id === shader.id));
      const nodes = present.map((shader) => ({
        id: shader.id,
        label: shader.title,
        icon: "blend",
        collapsible: true,
        children: shader.versions.map((version) => {
          const id = versionId(shader.id, version.id);
          const versionParams = { shader: shader.id, version: version.id };
          return {
            id,
            label: version.name,
            icon: "sliders-horizontal",
            resource: resource(id, projectId, `${shader.title}: ${version.name}`),
            target: target(id, projectId, `${shader.title}: ${version.name}`),
            selected: open?.id === id,
            contextMenuActions: [
              {
                id: "duplicate",
                label: l10n("versions.duplicate", "Duplicate"),
                icon: "copy",
                command: commands["version.duplicate"].ref,
                params: versionParams,
                input: {
                  name: params.text({ label: "Name", required: true, defaultValue: `${version.name} copy` }),
                },
                submitLabel: "Duplicate",
              },
              {
                id: "rename",
                label: l10n("versions.rename", "Rename"),
                icon: "pencil",
                command: commands["version.rename"].ref,
                params: versionParams,
                input: { name: params.text({ label: "Name", required: true, defaultValue: version.name }) },
                submitLabel: "Rename",
              },
              {
                id: "delete",
                label: l10n("versions.delete", "Delete"),
                icon: "trash",
                command: commands["version.delete"].ref,
                params: versionParams,
              },
            ],
          };
        }),
      }));
      return [
        {
          id: "shaders",
          label: l10n("versions.title", "Shaders"),
          collapsible: false,
          actions: [
            {
              id: "add",
              label: l10n("versions.add", "Add shader"),
              icon: "plus",
              command: commands["shaders.add"].ref,
              disabled: missing.length === 0,
              input: {
                shader: params.select({
                  label: "Shader",
                  required: true,
                  options: missing.map((shader) => ({ value: shader.id, label: shader.title })),
                }),
              },
              submitLabel: "Add",
            },
          ],
          emptyState: {
            title: l10n("versions.empty", "No shaders"),
            description: l10n("versions.emptyDescription", "Add a shader to start tuning it."),
            icon: "blend",
          },
          nodes,
        },
      ];
    },
  },
});
