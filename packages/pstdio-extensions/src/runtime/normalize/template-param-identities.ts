import { historicalContributionId } from "pstdio-api-contracts/extension-identity";
import type { ExtensionRuntime } from "../../types/runtime";
import { isRecord } from "./accumulator";

export const normalizeTemplateParamIdentities = (runtime: ExtensionRuntime) => {
  const aliases = new Map<string, string>();
  for (const type of runtime.templateTypes) {
    const previous = historicalContributionId({
      extensionId: type.extensionId,
      kind: "template-type",
      id: type.localId,
    });
    if (previous) aliases.set(previous, type.id);
  }
  for (const command of runtime.commands)
    for (const param of Object.values(command.params))
      if (isRecord(param) && param.type === "template" && typeof param.templateType === "string")
        param.templateType = aliases.get(param.templateType) ?? param.templateType;
};
