import { eventRef } from "@pstdio/sdk/extensions";

export const shadersChanged = eventRef<Record<string, never>>({
  extensionId: "pstdio.pstdio-shader-lab",
  id: "shaders.changed",
});
