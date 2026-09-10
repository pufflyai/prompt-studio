import type { ArtifactSummary } from "../artifacts";
import { artifactTarget } from "../contracts";

export const exampleArtifact: ArtifactSummary = {
  id: "revision-1",
  artifactId: "artifact-1",
  revisionId: "revision-1",
  title: "Release overview",
  favicon: "📦",
  label: "First draft",
  publishedAt: "2026-09-08T10:00:00Z",
  size: 1200,
  hash: "example",
  url: "/example",
  resource: { type: "artifact", id: "artifact-1", projectId: "project-1", extensionId: "pstdio.pstdio-artifacts" },
  target: artifactTarget("project-1", "artifact-1", "Release overview"),
};
