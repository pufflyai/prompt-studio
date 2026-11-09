import type { WebviewClient } from "@pstdio/sdk/extensions";
import type { ArtifactSummary } from "./artifacts";
import type { commands } from "./commands";
import { artifactUrl, changedEvent } from "./contracts";

export const createArtifactQueries = (client: WebviewClient<typeof commands>, projectId: string) => {
  const scope = { projectId };
  const content = (artifactId: string, revisionId?: string) =>
    client.queries.query({
      id: "artifacts.content",
      scope,
      resourceKey: artifactId,
      params: { revisionId: revisionId ?? null },
      dependency: { resourceId: artifactId },
      // Keep the accepted page running until the person chooses another immutable revision.
      events: [],
      read: () =>
        client.commands.read({
          url: artifactUrl(projectId, artifactId),
          ...(revisionId ? { revisionId } : {}),
        }),
    });
  return {
    list: () =>
      client.queries.query({
        id: "artifacts.list",
        scope,
        events: [changedEvent],
        read: () => client.commands.list(),
      }),
    revisions: (artifactId: string) =>
      client.queries.query({
        id: "artifacts.revisions",
        scope,
        resourceKey: artifactId,
        dependency: { resourceId: artifactId },
        events: [changedEvent],
        read: () => client.commands.revisions({ url: artifactUrl(projectId, artifactId) }),
      }),
    content,
    async preview(item: ArtifactSummary) {
      const query = content(item.artifactId, item.revisionId);
      const stop = query.subscribe(() => {}, { automatic: false });
      try {
        return (await query.read()).html;
      } finally {
        stop();
      }
    },
  };
};
