import type { HarnessParams } from "pstdio-api-contracts";
import { findAgentModel, resolveAgentModelParams } from "pstdio-api-contracts/agent-model-params";
import type { HarnessParamsSchema } from "pstdio-api-contracts/extension-kernel";
import { defaultHarnessParams, validateHarnessParams } from "pstdio-api-runtime-host";
import { harnessParamsPreferenceKey } from "pstdio-db";
import type { SessionsRouteDeps } from "./deps";

export class HarnessParamError extends Error {}

type HarnessParamDeps = Pick<SessionsRouteDeps, "preferencesDBService" | "harnessRegistry">;
interface StoredDefaults {
  value: unknown;
  created_at: string;
}

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

  const stored = await deps.preferencesDBService.get(harnessParamsPreferenceKey(input.projectId, input.agentId));
  if (!stored) return {};
  const value = (stored.value as StoredDefaults | null)?.value;
  if (!isHarnessParams(value)) {
    throw new HarnessParamError(`Stored harness params are invalid: ${input.agentId}`);
  }
  return value;
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

  const key = harnessParamsPreferenceKey(input.projectId, input.agentId);
  const previous = await deps.preferencesDBService.get(key);
  await deps.preferencesDBService.set({
    ...key,
    project_id: input.projectId,
    sync: "team",
    value: {
      value: input.params,
      created_at: (previous?.value as StoredDefaults | null)?.created_at ?? new Date().toISOString(),
    },
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
