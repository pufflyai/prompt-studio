import type { WebviewClient } from "@pstdio/sdk/extensions";
import type { ArtifactSummary } from "./artifacts";
import type { commands } from "./commands";
import { artifactResource, artifactUrl, changedEvent } from "./contracts";

export const createArtifactQueries = (client: WebviewClient<typeof commands>, projectId: string) => {
  const content = (artifactId: string, revisionId?: string) =>
    client.commands.read.query(
      {
        url: artifactUrl(projectId, artifactId),
        ...(revisionId ? { revisionId } : {}),
      },
      {
        resource: artifactResource(projectId, artifactId),
        dependency: { resourceId: artifactId },
        // Keep the accepted page running until the person chooses another immutable revision.
        events: [],
      },
    );
  return {
    list: () =>
      client.commands.list.query(undefined, {
        events: [changedEvent],
      }),
    revisions: (artifactId: string) =>
      client.commands.revisions.query(
        { url: artifactUrl(projectId, artifactId) },
        {
          resource: artifactResource(projectId, artifactId),
          dependency: { resourceId: artifactId },
          events: [changedEvent],
        },
      ),
    content,
    async preview(item: ArtifactSummary, signal?: AbortSignal) {
      const query = content(item.artifactId, item.revisionId);
      return (await query.read(signal)).html;
    },
  };
};

/** A presentation preference never reads or rewrites an artifact document or its history. */
export const createArtifactRevisionSelection = (
  client: WebviewClient<typeof commands>,
  projectId: string,
  id: string,
) => {
  const name = "artifact.revision." + id;
  const scope = { scope: "project" as const, scopeId: projectId };
  const query = client.preferences.query(name, scope);
  return { query, save: (revision: string) => client.preferences.set(name, revision, scope) };
};
