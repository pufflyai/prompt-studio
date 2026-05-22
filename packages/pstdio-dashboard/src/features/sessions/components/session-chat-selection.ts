import { resolvePreferredAgentModel } from "@/shared/agent-model-selection";
import type { CodingAgent } from "@/shared/agent-storage";

export const DEFAULT_AGENT_ID = "opencode" satisfies CodingAgent;

export const resolveInitialSessionChatSelection = (input: {
  sessionAgent: string | null | undefined;
  sessionLastSelectedModel: string | null | undefined;
  lastSelectedAgent: string | null | undefined;
  lastSelectedModels: string[];
  configuredModel?: string;
}) => {
  const agent = (input.sessionAgent ?? input.lastSelectedAgent ?? DEFAULT_AGENT_ID) as CodingAgent;
  const sessionLastSelectedModel = input.sessionLastSelectedModel?.trim();
  const isExistingSession = input.sessionAgent != null || input.sessionLastSelectedModel != null;
  const fallbackModel =
    resolvePreferredAgentModel({
      configuredModel: input.configuredModel,
      modelHistory: input.lastSelectedModels,
    }) || "";
  const model = isExistingSession ? (sessionLastSelectedModel ?? "") : fallbackModel;

  return { agent, model };
};
