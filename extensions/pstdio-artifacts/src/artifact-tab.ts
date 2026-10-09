import type { ExtensionContextBase, PlacementTabMenuGroup, RendererContext } from "@pstdio/sdk/extensions";
import { l10n } from "@pstdio/sdk/extensions";
import { deleteResource, renameResource } from "./artifact-actions";
import { serviceFor } from "./artifact-context";
import { artifactUrl } from "./contracts";

export const queryArtifactTab = async (ctx: ExtensionContextBase, input: { renderer: RendererContext }) => {
  const id = input.renderer.resource?.id;
  if (!id) return {};
  const current = (await serviceFor(ctx).revisions(artifactUrl(ctx.projectId, id)))[0];
  if (!current) return {};
  const menu: PlacementTabMenuGroup[] = [
    {
      id: "artifact-actions",
      rows: [
        {
          id: "rename",
          label: l10n("reader.rename", "Rename artifact…"),
          icon: "pencil",
          action: {
            kind: "command",
            target: { command: renameResource.ref, params: { artifactId: id, name: current.title } },
          },
        },
        {
          id: "delete",
          label: l10n("reader.delete", "Delete artifact…"),
          icon: "trash",
          action: {
            kind: "command",
            target: { command: deleteResource.ref, params: { artifactId: id } },
          },
        },
      ],
    },
  ];
  return { label: current.title, menu };
};
