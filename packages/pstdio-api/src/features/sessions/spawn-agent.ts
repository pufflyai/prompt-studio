import type { ExtensionSetupContext, HarnessQuestionResponse, RuntimeHarnessProvider } from "@pstdio/sdk/extensions";
import type { SessionMessage } from "pstdio-agents";
import type { RouteDeps } from "../deps";
import { toAgentId, toHarnessId } from "../harnesses/harness-ids";
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
  projectId?: string;
};

type SpawnDeps = ProviderSpawnDeps & Pick<RouteDeps, "harnessProviderService">;

const resolveHarnessSessionProvider = async (input: { agentId: string; projectId?: string }, deps: SpawnDeps) => {
  const harnessId = toHarnessId(toAgentId(input.agentId));
  const resolved = await deps.harnessProviderService.resolve(harnessId, input.projectId);
  if (!resolved) throw new Error(`Harness not found: ${harnessId}`);

  return {
    providerId: harnessId,
    provider: createHarnessSessionProvider(resolved.provider, resolved.context),
  };
};

export const spawnAgentSession = async (input: SpawnInput, deps: SpawnDeps) => {
  const provider = await resolveHarnessSessionProvider(input, deps);

  return spawnProviderSession({ ...input, provider: provider.provider }, deps);
};

type ResumeInput = {
  sessionId: string;
  agentSessionId: string;
  agentId: string;
  prompt: string;
  model?: string;
  cwd?: string;
  messageOffset?: number;
  questionResponse?: HarnessQuestionResponse;
  projectId?: string;
};

export const resumeAgentSession = async (input: ResumeInput, deps: SpawnDeps) => {
  const provider = await resolveHarnessSessionProvider(input, deps);

  return resumeProviderSession({ ...input, provider: provider.provider }, deps);
};

type ReattachInput = {
  sessionId: string;
  agentSessionId: string;
  agentId: string;
  cwd?: string;
  projectId?: string;
};

export const reattachAgentSession = async (input: ReattachInput, deps: SpawnDeps) => {
  const provider = await resolveHarnessSessionProvider(input, deps);

  return reattachProviderSession({ ...input, providerId: provider.providerId, provider: provider.provider }, deps);
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
