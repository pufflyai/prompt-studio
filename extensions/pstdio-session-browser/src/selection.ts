import type { ControlValueMap, ExtensionHarnessInput } from "@pstdio/sdk/extensions";

export const selectedHarness = (values: ControlValueMap): ExtensionHarnessInput | undefined => {
  const value = values.harness;
  return value && typeof value === "object" && !Array.isArray(value) && "harnessId" in value && value.harnessId
    ? value
    : undefined;
};
export const selectedWorkspace = (values: ControlValueMap) =>
  typeof values.workspace === "string" && values.workspace ? values.workspace : undefined;
