// Keep only ticket-to-library references; the artifact library remains the content owner.
import type { CommandContext } from "@pstdio/sdk/extensions";
import { type ArtifactNode, artifacts } from "../artifacts";
import { callPlanner } from "../planner";

export const artifactNodes = (ctx: Pick<CommandContext, "storage">) =>
  ctx.storage.collection<{ ticketId: string; url: string }>("artifact-nodes");

export async function readArtifactNodes(ctx: CommandContext) {
  const links = await artifactNodes(ctx).list();
  if (!links.length) {
    return new Map<string, ArtifactNode>();
  }
  // A missing or temporarily unavailable artifact must not hide the rest of the project plan.
  const library = await callPlanner(ctx, artifacts.list, {}).catch(() => []);
  const byUrl = new Map(library.map((item) => [item.url, item]));
  return new Map(
    links.map(({ ticketId, url }) => {
      const item = byUrl.get(url);
      const node: ArtifactNode = item
        ? { url, title: item.title, available: true, revisionId: item.revisionId, target: item.target }
        : { url, title: "Artifact unavailable", available: false };
      return [ticketId, node];
    }),
  );
}
