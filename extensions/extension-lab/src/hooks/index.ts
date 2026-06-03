import type { ExtensionDefinition } from "@pstdio/sdk/extensions";
import { notifySentienceRejectedHook } from "./lab-hooks";

export const labHooks = {
  notifySentienceRejected: notifySentienceRejectedHook,
} satisfies NonNullable<ExtensionDefinition["hooks"]>;
