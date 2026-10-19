import type { PstdioClient } from "@pstdio/sdk/client";
import type { WebviewHostCapabilityParams } from "pstdio-api-contracts/extension-kernel";
import { getApiClient } from "@/lib/api";

export const createHarnessReadCapability =
  (projectId: string, client?: Pick<PstdioClient, "agents" | "projects">) =>
  async (input: WebviewHostCapabilityParams["harnesses.read"]) => {
    const api = client ?? getApiClient();
    const [harnesses, project] = await Promise.all([
      api.agents.info({ project: projectId }),
      api.projects.get(projectId),
    ]);
    const harnessId =
      input.harnessId ??
      project.default_agent_id ??
      harnesses.find((harness) => harness.availability.type === "INSTALLED")?.id;
    const selected = harnesses.find((harness) => harness.id === harnessId);
    if (!selected) return { harnesses, models: [] };
    const [models, parameters] = await Promise.all([
      selected.supportsModels ? api.agents.models(selected.id, projectId) : [],
      api.agents.getParamDefaults(projectId, selected.id, input.model),
    ]);
    const preferredModel =
      input.model ?? (selected.id === project.default_agent_id ? project.default_agent_model : undefined);
    const model =
      models.find(({ id }) => id === preferredModel)?.id ??
      models.find((model) => model.isDefault)?.id ??
      models[0]?.id;
    return {
      harnesses,
      models,
      schema: parameters.schema ?? undefined,
      defaults: parameters.defaults,
      selection: { harnessId: selected.id, ...(model ? { model } : {}) },
    };
  };
