// Use the artifact library's public commands; it owns published HTML and navigation targets.
import { commandRef, eventRef, type NavigationTarget } from "@pstdio/sdk/extensions";

export interface ArtifactSummary {
  artifactId: string;
  revisionId: string;
  title: string;
  url: string;
  target: NavigationTarget;
  publishedAt: string;
}

export interface ArtifactNode {
  url: string;
  title: string;
  available: boolean;
  revisionId?: string;
  target?: NavigationTarget;
}

const artifactCommand = commandRef.forExtension({ publisher: "pstdio", name: "pstdio-artifacts" });
export const artifacts = {
  list: artifactCommand<{ search?: string }, ArtifactSummary[]>("list"),
  read: artifactCommand<{ url: string }, ArtifactSummary & { html: string }>("read"),
};
export const artifactsChanged = eventRef<{ artifactId?: string }>({
  extensionId: "pstdio.pstdio-artifacts",
  id: "artifacts.changed",
});
