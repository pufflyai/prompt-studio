import type { ReactOptions } from "i18next";
import type { AgentModel, HarnessParamsInfo } from "pstdio-api-contracts";
import { resolveAgentModelParams } from "pstdio-api-contracts/agent-model-params";
import { useTranslation } from "react-i18next";
import type i18n from "@/i18n";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { localizeExtensionValue } from "@/shared/extensions/extension-localization";

export const harnessParamPresentation = (
  schema: HarnessParamsInfo | undefined,
  model: Pick<AgentModel, "paramOverrides"> | undefined,
  extensionId?: string,
  projectId?: string,
  owner = getRuntimeCollections(),
  translate?: typeof i18n.t,
) => {
  const resolved = resolveAgentModelParams(schema, model);
  return localizeExtensionValue(resolved, extensionId, owner, projectId, translate) as typeof resolved;
};

const translationEvents = { bindI18n: "languageChanged loaded", bindI18nStore: "added removed" } satisfies ReactOptions;

export const useHarnessParamPresentation = (
  schema: HarnessParamsInfo | undefined,
  model: Pick<AgentModel, "paramOverrides"> | undefined,
  extensionId?: string,
  projectId?: string,
) => {
  const { t } = useTranslation(undefined, translationEvents);
  return harnessParamPresentation(schema, model, extensionId, projectId, undefined, t);
};
