import { validateHarnessParams } from "./harness-params";

export { defaultHarnessParams, validateHarnessParams } from "./harness-params";

import type {
  AgentCapability,
  AgentModel,
  HarnessCommandContext,
  HarnessCommandDiscoveryContext,
  HarnessCommandState,
  HarnessExit,
  HarnessMessagesInput,
  HarnessOperation,
  HarnessReattachInput,
  HarnessRecoveryInput,
  HarnessRecoveryResult,
  HarnessResumeInput,
  HarnessSession,
  HarnessStartInput,
  PreparedHarnessOperation,
  SessionMessage,
} from "pstdio-api-contracts";
import { findAgentModel, resolveAgentModelParams } from "pstdio-api-contracts/agent-model-params";
import type {
  HarnessAuthentication,
  HarnessAuthenticationChannel,
  HarnessAuthenticationInput,
  HarnessContext,
  HarnessDetectionResult,
  HarnessParamsSchema,
  HarnessSkillsLayout,
  Localizable,
  MaybePromise,
} from "pstdio-api-contracts/extension-kernel";
import type { RuntimeHarnessRecord } from "pstdio-extensions";
import { createHarnessAuthenticationLifetime } from "./harness-authentication";
import { detectHarness } from "./harness-detection";
import { HarnessDisposedError } from "./harness-disposed-error";
import { createHarnessSessionResources, type HarnessSessionResources } from "./harness-session-resources";
import { createRetainedHarnessCalls } from "./harness-session-retention";

export type HarnessCallOptions = {
  /** Project the call runs on behalf of, when there is one (session dispatch). */
  projectId?: string;
  model?: string;
};

export type HarnessContextFactory = (
  record: RuntimeHarnessRecord,
  options?: HarnessCallOptions,
) => MaybePromise<HarnessContext>;

export type HarnessHandle = {
  /** Namespaced `${extensionId}.${localId}`. */
  id: string;
  localId: string;
  extensionId: string;
  label: Localizable<string>;
  /** Normalized skill directories when the provider declares them. */
  skills: { dir: string; globalDir: string } | null;
  /** Discrete run params declared by the harness, if any. */
  params: HarnessParamsSchema | null;
  cwdRequirement: "required" | "optional";
  supportsReattach: boolean;
  supportsHistory: boolean;
  /** The harness offers a model choice through `listModels`. */
  supportsModels: boolean;
  capabilities(options?: HarnessCallOptions): Promise<AgentCapability[]>;
  detect(options?: HarnessCallOptions): Promise<HarnessDetectionResult>;
  getAuthentication?(options?: HarnessCallOptions): Promise<HarnessAuthentication>;
  authenticate?(
    input: HarnessAuthenticationInput,
    channel: HarnessAuthenticationChannel,
    options?: HarnessCallOptions,
  ): Promise<void>;
  listModels(options?: HarnessCallOptions): Promise<AgentModel[]>;
  start(input: HarnessStartInput, options?: HarnessCallOptions): Promise<HarnessSession>;
  resume(input: HarnessResumeInput, options?: HarnessCallOptions): Promise<HarnessSession>;
  reattach(input: HarnessReattachInput, options?: HarnessCallOptions): Promise<HarnessSession>;
  getMessages(input: HarnessMessagesInput, options?: HarnessCallOptions): Promise<SessionMessage[]>;
  recoverMessages(input: HarnessRecoveryInput, options?: HarnessCallOptions): Promise<HarnessRecoveryResult>;
  getCommandState(input: HarnessCommandDiscoveryContext, options?: HarnessCallOptions): Promise<HarnessCommandState>;
  prepareOperation(
    input: HarnessCommandContext,
    operation: HarnessOperation,
    options?: HarnessCallOptions,
  ): Promise<PreparedHarnessOperation>;
  dispose(): Promise<void>;
};

export type HarnessRegistry = {
  get(id: string): HarnessHandle | null;
  list(): HarnessHandle[];
  /** Namespaced ids that appeared more than once; last install won. */
  duplicates: string[];
  dispose(): Promise<void>;
};

const FAILED_EXIT: HarnessExit = { status: "failed" };

const isHarnessExit = (value: unknown): value is HarnessExit => {
  if (!value || typeof value !== "object") return false;
  const status = (value as HarnessExit).status;
  return status === "completed" || status === "failed" || status === "cancelled" || status === "disconnected";
};

// `done` must settle exactly once and never reject, so a misbehaving provider
// still transitions the session to "failed" instead of wedging it.
const adaptSession = (session: HarnessSession): HarnessSession => ({
  ...session,
  done: Promise.resolve(session.done)
    .then((exit) => (isHarnessExit(exit) ? exit : FAILED_EXIT))
    .catch(() => FAILED_EXIT),
});

const normalizeSkills = (skills: HarnessSkillsLayout | undefined) => {
  if (!skills || typeof skills.dir !== "string" || skills.dir.length === 0) return null;
  return { dir: skills.dir, globalDir: skills.globalDir || skills.dir };
};

const toHandle = (
  record: RuntimeHarnessRecord,
  buildContext: HarnessContextFactory,
  resources: HarnessSessionResources,
): HarnessHandle => {
  const contexts = new Map<string | undefined, Promise<HarnessContext>>();
  let closing: Promise<void> | undefined;
  let disposed = false;
  const ensureActive = () => {
    if (disposed) throw new HarnessDisposedError(`Harness has been disposed: ${record.id}`);
  };
  const ctx = async (options?: HarnessCallOptions) => {
    ensureActive();
    const key = options?.projectId;
    let value = contexts.get(key);
    if (!value) {
      value = Promise.resolve().then(() => buildContext(record, options));
      contexts.set(key, value);
    }
    const context = await value;
    ensureActive();
    return context;
  };
  const provider = record.provider;
  const authentication = createHarnessAuthenticationLifetime();
  const retained = createRetainedHarnessCalls(provider, ctx, resources);
  if (provider.getMessages && !provider.recoverMessages) {
    throw new Error(`Harness with native history must provide recoverMessages: ${record.id}`);
  }
  const params = provider.params ?? null;

  const validateInputParams = async (input: HarnessStartInput | HarnessResumeInput, options?: HarnessCallOptions) => {
    if (!provider.listModels) {
      validateHarnessParams(params, input.params);
      return;
    }

    const models = await provider.listModels(await ctx(options));
    const model = findAgentModel(models, input.model);
    validateHarnessParams(resolveAgentModelParams(params, model), input.params);
  };

  return {
    id: record.id,
    localId: record.localId,
    extensionId: record.extensionId,
    label: provider.label,
    skills: normalizeSkills(provider.skills),
    params,
    cwdRequirement: provider.cwdRequirement ?? "required",
    supportsReattach: typeof provider.reattach === "function",
    supportsHistory: typeof provider.getMessages === "function",
    supportsModels: typeof provider.listModels === "function",
    capabilities: async (options) => provider.capabilities(await ctx(options)),
    detect: async (options) => detectHarness(provider, await ctx(options)),
    ...(provider.getAuthentication
      ? {
          getAuthentication: async (options?: HarnessCallOptions) =>
            provider.getAuthentication!(await ctx(options), { model: options?.model }),
        }
      : {}),
    ...(provider.authenticate
      ? {
          authenticate: async (
            input: HarnessAuthenticationInput,
            channel: HarnessAuthenticationChannel,
            options?: HarnessCallOptions,
          ) => {
            ensureActive();
            const context = await ctx(options);
            await authentication.run(channel, async (channel) => {
              await provider.authenticate!(context, input, channel);
            });
          },
        }
      : {}),
    listModels: async (options) => (provider.listModels ? provider.listModels(await ctx(options)) : []),
    start: async (input, options) => {
      await validateInputParams(input, options);
      return retained.invoke(
        input,
        options,
        async () => adaptSession(await provider.start(await ctx(options), input)),
        (run) => run.done,
      );
    },
    resume: async (input, options) => {
      await validateInputParams(input, options);
      return retained.invoke(
        input,
        options,
        async () => adaptSession(await provider.resume(await ctx(options), input)),
        (run) => run.done,
      );
    },
    reattach: async (input, options) => {
      if (!provider.reattach) throw new Error(`Harness does not support reattach: ${record.id}`);
      return retained.invoke(
        input,
        options,
        async () => adaptSession(await provider.reattach!(await ctx(options), input)),
        (run) => run.done,
      );
    },
    getMessages: async (input, options) =>
      provider.getMessages ? provider.getMessages(await ctx(options), input) : [],
    recoverMessages: async (input, options) =>
      provider.recoverMessages
        ? provider.recoverMessages(await ctx(options), input)
        : { kind: "recovered", messages: [...input.knownMessages] },
    getCommandState: async (input, options) =>
      retained.invoke(input, options, async () =>
        provider.getCommandState
          ? provider.getCommandState(await ctx(options), input)
          : { commands: [], modes: [], slashCommands: false },
      ),
    prepareOperation: async (input, operation, options) => {
      if (!provider.prepareOperation) throw new Error("This harness does not support native commands.");
      const context = await ctx(options);
      const prepared = await retained.invoke(input, options, async () => {
        if (operation.kind === "command" && provider.getCommandState) {
          const state = await provider.getCommandState(context, input);
          const name = /^\/\S+/.exec(operation.text)?.[0];
          const command = state.commands.find((entry) => entry.name === name);
          if (command?.disabledReason) throw new Error(command.disabledReason);
        }
        return provider.prepareOperation!(context, input, operation);
      });
      ensureActive();
      return {
        execution: prepared.execution,
        invoke: async (invocation) => {
          ensureActive();
          const result = await retained.invoke(
            input,
            options,
            async () => prepared.invoke(invocation),
            (result) => (result.kind === "started" ? result.session.done : Promise.resolve()),
          );
          if (result.kind === "started") {
            if (disposed) {
              await result.session.stop();
              throw new HarnessDisposedError(`Harness has been disposed: ${record.id}`);
            }
            return { ...result, session: adaptSession(result.session) };
          }
          return result;
        },
      };
    },
    dispose: () => {
      disposed = true;
      closing ??= (async () => {
        await authentication.dispose();
        await retained.retire();
        const results = await Promise.allSettled(
          [...contexts.values()].map((context) =>
            context.then(
              (value) => provider.dispose?.(value),
              () => undefined,
            ),
          ),
        );
        const errors = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
        if (errors.length) throw new AggregateError(errors, `Harness cleanup failed: ${record.id}`);
      })();
      return closing;
    },
  };
};

export const createHarnessRegistry = (
  records: RuntimeHarnessRecord[],
  buildContext: HarnessContextFactory,
  resources: HarnessSessionResources = createHarnessSessionResources(),
): HarnessRegistry => {
  const handles = new Map<string, HarnessHandle>();
  const duplicates: string[] = [];

  for (const record of records) {
    if (handles.has(record.id)) duplicates.push(record.id);
    handles.set(record.id, toHandle(record, buildContext, resources));
  }

  return {
    get: (id) => handles.get(id) ?? null,
    list: () => [...handles.values()],
    duplicates,
    dispose: async () => {
      const results = await Promise.allSettled([...handles.values()].map((handle) => handle.dispose()));
      const errors = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
      if (errors.length) throw new AggregateError(errors, "Harness registry cleanup failed.");
    },
  };
};
