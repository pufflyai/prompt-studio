import { eventRef } from "@pstdio/sdk/extensions";

export const labArtifactsChanged = eventRef<{ artifactId: string }>({
  extensionId: "pstdio.workbench-fixture",
  id: "artifacts.changed",
});
