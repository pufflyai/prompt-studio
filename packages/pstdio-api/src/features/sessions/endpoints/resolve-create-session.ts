import type { HarnessRegistryService } from "../../harnesses/harness-registry-service";

type ProjectRecord = {
  id: string;
  default_agent_id?: string | null;
  default_agent_model?: string | null;
};

type Harness = NonNullable<Awaited<ReturnType<HarnessRegistryService["get"]>>>;

export type ResolveAgentResult =
  | { type: "error"; error: string }
  | { type: "ok"; agentId: string | undefined; harness: Harness | undefined };

// Harness availability per project is extension enablement: a harness resolves for a
// project iff its extension is enabled there. Resolution order: explicit request,
// project default, then the first available harness.
export const resolveCreateSessionAgent = async (
  inputAgent: string | undefined,
  project: ProjectRecord | null,
  harnessRegistry: HarnessRegistryService,
): Promise<ResolveAgentResult> => {
  const projectId = project?.id;

  if (inputAgent) {
    const harness = await harnessRegistry.get(inputAgent, { projectId });
    if (harness) return { type: "ok", agentId: inputAgent, harness };
    return { type: "error", error: `Agent '${inputAgent}' is not enabled for this project.` };
  }

  const projectDefault = project?.default_agent_id ?? null;
  const defaultHarness = projectDefault ? await harnessRegistry.get(projectDefault, { projectId }) : null;
  if (projectDefault && defaultHarness) return { type: "ok", agentId: projectDefault, harness: defaultHarness };

  const [fallback] = await harnessRegistry.list({ projectId });
  return { type: "ok", agentId: fallback?.id, harness: fallback };
};

export const resolveCreateSessionModel = async (
  inputModel: string | undefined,
  project: ProjectRecord | null,
  agentId: string,
  harnessRegistry: HarnessRegistryService,
  options: { requestAgentWasOmitted: boolean },
) => {
  const trimmedInputModel = inputModel?.trim();
  if (trimmedInputModel) return trimmedInputModel;

  const harness = await harnessRegistry.get(agentId, { projectId: project?.id });
  if (!harness) return undefined;
  const models = await harness.listModels?.();
  if (!models) return undefined;

  const projectDefaultAgent = project?.default_agent_id ?? null;
  const projectDefaultModel = project?.default_agent_model ?? null;

  if (
    options.requestAgentWasOmitted &&
    projectDefaultModel &&
    projectDefaultAgent === agentId &&
    models.some((model) => model.id === projectDefaultModel)
  ) {
    return projectDefaultModel;
  }

  return models.find((model) => model.isDefault)?.id ?? models[0]?.id;
};
