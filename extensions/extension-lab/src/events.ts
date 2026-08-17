import { eventRef } from "@pstdio/sdk/extensions";

export const labArtifactsChanged = eventRef<{ artifactId: string }>("extension-lab.artifacts.changed");
