import { eventRef } from "@pstdio/sdk/extensions";

export const labArtifactsChanged = eventRef<{ artifactId: string }>({
  extensionId: "pstdio.extension-lab",
  id: "artifacts.changed",
});
