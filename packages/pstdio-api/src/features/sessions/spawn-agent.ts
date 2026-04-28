import type { ExtensionSetupContext, RuntimeHarnessProvider } from "@pstdio/sdk/extensions";
import type { AgentId, QuestionResponse, SessionMessage } from "pstdio-agents";
import type { RouteDeps } from "../deps";
import {
  type ProviderSpawnDeps,
  reattachProviderSession,
  resumeProviderSession,
  type SessionProvider,
  spawnProviderSession,
} from "./session-provider-runner";

type SpawnInput = {
  sessionId: string;
  agentId: string;
  prompt: string;
  title?: string;
  model?: string;
  cwd?: string;
};

type SpawnDeps = ProviderSpawnDeps & Pick<RouteDeps, "agentRegistry">;

export const spawnAgentSession = async (input: SpawnInput, deps: SpawnDeps) => {
  const agent = deps.agentRegistry.get(input.agentId as AgentId);
  if (!agent) throw new Error(`Agent not found: ${input.agentId}`);

  return spawnProviderSession({ ...input, provider: agent }, deps);
};

type ResumeInput = {
  sessionId: string;
  agentSessionId: string;
  agentId: string;
  prompt: string;
  model?: string;
  cwd?: string;
  messageOffset?: number;
  questionResponse?: QuestionResponse;
};

export const resumeAgentSession = async (input: ResumeInput, deps: SpawnDeps) => {
  const agent = deps.agentRegistry.get(input.agentId as AgentId);
  if (!agent) throw new Error(`Agent not found: ${input.agentId}`);

  return resumeProviderSession({ ...input, provider: agent }, deps);
};

type ReattachInput = {
  sessionId: string;
  agentSessionId: string;
  agentId: string;
  cwd?: string;
};

export const reattachAgentSession = async (input: ReattachInput, deps: SpawnDeps) => {
  const agent = deps.agentRegistry.get(input.agentId as AgentId);
  if (!agent?.reattachSession) throw new Error(`Agent does not support reattach: ${input.agentId}`);

  return reattachProviderSession({ ...input, providerId: input.agentId, provider: agent }, deps);
};

const createHarnessSessionProvider = (provider: RuntimeHarnessProvider, context: ExtensionSetupContext) =>
  ({
    startSession(input) {
      if (!provider.startSession) throw new Error(`Harness does not support session start: ${provider.id}`);
      return provider.startSession(context, input);
    },
    resumeSession(input, eventStore, approvalService) {
      if (!provider.resumeSession) throw new Error(`Harness does not support session resume: ${provider.id}`);
      return provider.resumeSession(context, input, eventStore, approvalService);
    },
    reattachSession: provider.reattachSession
      ? (input, eventStore) => provider.reattachSession!(context, input, eventStore)
      : undefined,
    getMessages(sessionId, input) {
      return (provider.getMessages?.(context, sessionId, input) ?? Promise.resolve([])) as Promise<SessionMessage[]>;
    },
  }) satisfies SessionProvider;

export const spawnHarnessProviderSession = async (
  input: Omit<SpawnInput, "agentId"> & {
    provider: RuntimeHarnessProvider;
    context: ExtensionSetupContext;
  },
  deps: ProviderSpawnDeps,
) =>
  spawnProviderSession(
    {
      ...input,
      provider: createHarnessSessionProvider(input.provider, input.context),
    },
    deps,
  );

export const resumeHarnessProviderSession = async (
  input: Omit<ResumeInput, "agentId"> & {
    provider: RuntimeHarnessProvider;
    context: ExtensionSetupContext;
  },
  deps: ProviderSpawnDeps,
) =>
  resumeProviderSession(
    {
      ...input,
      provider: createHarnessSessionProvider(input.provider, input.context),
    },
    deps,
  );
