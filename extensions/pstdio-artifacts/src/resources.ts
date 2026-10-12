import { defineCommandPaletteResource, l10n } from "@pstdio/sdk/extensions";
import { serviceFor } from "./artifact-context";
import { changedEvent } from "./contracts";
import { artifact } from "./pages";

export const artifactResources = defineCommandPaletteResource({
  id: "artifacts",
  title: l10n("search.artifacts", "Artifacts"),
  resourceKind: artifact.ref,
  refreshEvents: [changedEvent],
  async query(ctx, input) {
    const artifacts = await serviceFor(ctx).list(input.query);
    return {
      items: artifacts.slice(0, input.limit).map((item) => ({
        id: item.artifactId,
        label: item.title,
        icon: "file-code",
        target: item.target,
      })),
    };
  },
});
