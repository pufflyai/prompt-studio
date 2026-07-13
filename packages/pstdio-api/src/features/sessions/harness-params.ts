import type { HarnessParams } from "pstdio-api-contracts";
import { findAgentModel, resolveAgentModelParams } from "pstdio-api-contracts/agent-model-params";
import type { HarnessParamsSchema } from "pstdio-api-contracts/extension-kernel";
import { defaultHarnessParams, validateHarnessParams } from "pstdio-api-runtime-host";
import type { SessionsRouteDeps } from "./deps";

export class HarnessParamError extends Error {}

const HOST_HARNESS_PARAMS_EXTENSION_ID = "pstdio.harness-params";
const DEFAULTS_SETTING_KEY = "defaults";

type HarnessParamDeps = Pick<SessionsRouteDeps, "extensionSettingsDBService" | "harnessRegistry">;

const settingsOwner = (projectId: string, agentId: string) => ({
  owner_type: "extension_instance" as const,
  owner_id: `${projectId}:${agentId}`,
  extension_id: HOST_HARNESS_PARAMS_EXTENSION_ID,
});

const isHarnessParams = (value: unknown): value is HarnessParams => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => typeof entry === "string" || typeof entry === "boolean");
};

const matchesDescriptor = (descriptor: HarnessParamsSchema[string], value: HarnessParams[string]) => {
  if (descriptor.type === "boolean") return typeof value === "boolean";
  return typeof value === "string" && descriptor.options.some((option) => option.value === value);
};

export const filterDeclaredHarnessParams = (schema: HarnessParamsSchema | null | undefined, params: HarnessParams) => {
  if (!schema) return {};
  return Object.fromEntries(
    Object.entries(params).filter(([key, value]) => {
      const descriptor = schema[key];
      return descriptor ? matchesDescriptor(descriptor, value) : false;
    }),
  );
};

export const readHarnessProjectDefaults = async (
  deps: HarnessParamDeps,
  input: { projectId?: string; agentId: string },
) => {
  if (!input.projectId) return {};

  const stored = await deps.extensionSettingsDBService.getValue({
    ...settingsOwner(input.projectId, input.agentId),
    key: DEFAULTS_SETTING_KEY,
  });
  if (!stored) return {};
  if (!isHarnessParams(stored.value_json)) {
    throw new HarnessParamError(`Stored harness params are invalid: ${input.agentId}`);
  }
  return stored.value_json;
};

export const writeHarnessProjectDefaults = async (
  deps: HarnessParamDeps,
  input: { projectId: string; agentId: string; params: HarnessParams },
) => {
  const harness = await deps.harnessRegistry.get(input.agentId, { projectId: input.projectId });
  if (!harness) throw new HarnessParamError(`Harness not enabled for this project: ${input.agentId}`);

  try {
    validateHarnessParams(harness.params, input.params);
  } catch (error) {
    if (error instanceof Error) throw new HarnessParamError(error.message);
    throw error;
  }

  await deps.extensionSettingsDBService.setValue({
    ...settingsOwner(input.projectId, input.agentId),
    key: DEFAULTS_SETTING_KEY,
    value_json: input.params,
  });

  return {
    schema: harness.params,
    defaults: input.params,
  };
};

export const resolveHarnessRunParams = async (
  deps: HarnessParamDeps,
  input: {
    projectId?: string;
    agentId: string;
    model?: string;
    persistedOverrides?: HarnessParams;
    overrides?: HarnessParams;
  },
) => {
  const harness = await deps.harnessRegistry.get(input.agentId, { projectId: input.projectId });
  if (!harness) throw new HarnessParamError(`Harness not enabled for this project: ${input.agentId}`);
  const models = await harness.listModels({ projectId: input.projectId });
  const model = findAgentModel(models, input.model);
  const schema = resolveAgentModelParams(harness.params, model);
  const projectDefaults = filterDeclaredHarnessParams(schema, await readHarnessProjectDefaults(deps, input));
  const persistedOverrides = filterDeclaredHarnessParams(schema, input.persistedOverrides ?? {});

  const params = {
    ...defaultHarnessParams(schema),
    ...projectDefaults,
    ...persistedOverrides,
    ...(input.overrides ?? {}),
  };

  try {
    validateHarnessParams(schema, params);
  } catch (error) {
    if (error instanceof Error) throw new HarnessParamError(error.message);
    throw error;
  }
  return Object.keys(params).length > 0 ? params : undefined;
};
