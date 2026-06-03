import type { ExtensionDefinition } from "@pstdio/sdk/extensions";
import { rejectSentientAwakeningMiddleware } from "./reject-sentient-awakening";

export const labMiddlewares = {
  rejectSentientAwakening: rejectSentientAwakeningMiddleware,
} satisfies NonNullable<ExtensionDefinition["middlewares"]>;
