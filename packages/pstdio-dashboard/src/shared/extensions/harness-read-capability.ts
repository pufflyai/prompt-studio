import type { PstdioClient } from "@pstdio/sdk/client";
import type { WebviewHostCapabilityParams } from "pstdio-api-contracts/extension-kernel";
import { getApiClient } from "@/lib/api";
import { resolveSynchronizedModel } from "@/shared/agents/agent-model-selection";
import {
  type RecentHarnessStorage,
  readRecentHarnessSelection,
  resolveInitialHarnessSelection,
} from "@/shared/command-params/recent-harness-param";

interface HarnessReadOptions {
  client?: Pick<PstdioClient, "agents" | "projects">;
  storage?: RecentHarnessStorage;
}

// Picks the harness and model the native harness field would open with, so an
// embedded picker and the native form start from the same choice.
export const createHarnessReadCapability =
  (projectId: string, options: HarnessReadOptions = {}) =>
  async (input: WebviewHostCapabilityParams["harnesses.read"]) => {
    const api = options.client ?? getApiClient();
    const [harnesses, project] = await Promise.all([
      api.agents.info({ project: projectId }),
      api.projects.get(projectId),
    ]);
    const initial = resolveInitialHarnessSelection({
      current: { harnessId: input.harnessId ?? "", model: input.model ?? "" },
      recent: readRecentHarnessSelection(projectId, options.storage),
      defaultAgent: project.default_agent_id,
      agents: harnesses,
    });
    const selected = harnesses.find((harness) => harness.id === initial.harnessId);
    if (!selected) return { harnesses, models: [] };
    const models = selected.supportsModels ? await api.agents.models(selected.id, projectId) : [];
    const synchronized = resolveSynchronizedModel({
      currentAgent: selected.id,
      currentModel: initial.model,
      configuredModel:
        selected.id === project.default_agent_id ? (project.default_agent_model ?? undefined) : undefined,
      modelsQuery: { isPending: false, data: models },
      modelHistory: [],
    });
    const model = (synchronized ?? initial.model) || undefined;
    // Model-specific options only apply when the schema is read for the selected model.
    const parameters = await api.agents.getParamDefaults(projectId, selected.id, model);
    return {
      harnesses,
      models,
      schema: parameters.schema ?? undefined,
      defaults: parameters.defaults,
      selection: { harnessId: selected.id, ...(model ? { model } : {}) },
    };
  };
