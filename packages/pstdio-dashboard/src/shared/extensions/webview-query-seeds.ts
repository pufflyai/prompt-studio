import type { WebviewHostProps } from "@pstdio/sdk/extensions";
import { type HostCapabilityRegistry, validateWebviewCapabilityDeclarations } from "pstdio-extensions/bridge/contract";

/** Init props obey the same manifest permissions as RPCs, including supported declaration versions. */
export const authorizedWebviewQuerySeeds = (input: {
  declared?: readonly string[];
  capabilities: HostCapabilityRegistry;
  commands?(): WebviewHostProps["commandQueries"];
  preferences?(): NonNullable<WebviewHostProps["serviceQueries"]>["preferences"];
  account?(): NonNullable<WebviewHostProps["serviceQueries"]>["account"];
  performance?(): NonNullable<WebviewHostProps["serviceQueries"]>["performance"];
}): Pick<WebviewHostProps, "commandQueries" | "serviceQueries"> => {
  const { allowed } = validateWebviewCapabilityDeclarations(input.declared, input.capabilities);
  return {
    commandQueries: allowed.has("commands.query") ? input.commands?.() : undefined,
    serviceQueries: {
      preferences: allowed.has("preferences.get") ? input.preferences?.() : undefined,
      account: allowed.has("account.read") ? input.account?.() : undefined,
      performance: allowed.has("performance.read") ? input.performance?.() : undefined,
    },
  };
};
