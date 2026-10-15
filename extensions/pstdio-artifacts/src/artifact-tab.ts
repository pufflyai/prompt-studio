import type { ExtensionContextBase, RendererContext } from "@pstdio/sdk/extensions";
import { serviceFor } from "./artifact-context";
import { artifactUrl } from "./contracts";

export const queryArtifactTab = async (ctx: ExtensionContextBase, input: { renderer: RendererContext }) => {
  const id = input.renderer.resource?.id;
  if (!id) return {};
  const current = (await serviceFor(ctx).revisions(artifactUrl(ctx.projectId, id)))[0];
  return current ? { label: current.title } : {};
};
