import { validateHarnessParams } from "./harness-params";

export { defaultHarnessParams, validateHarnessParams } from "./harness-params";

import type {
  AgentCapability,
  AgentModel,
  HarnessCommandContext,
  HarnessCommandDiscoveryContext,
  HarnessCommandState,
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
import { createProcessOwner, type ProcessOwner, type RuntimeHarnessRecord } from "pstdio-extensions";
import { createHarnessAuthenticationLifetime } from "./harness-authentication";
import { createHarnessCommandObservations } from "./harness-command-observation";
import { detectHarness } from "./harness-detection";
import { HarnessDisposedError } from "./harness-disposed-error";
import { adaptSession, createHarnessOperationPreparation } from "./harness-prepared-operation";
import { createHarnessCallOwnership } from "./harness-process-ownership";
import { createHarnessSessionResources, type HarnessSessionResources } from "./harness-session-resources";
import { createRetainedHarnessCalls } from "./harness-session-retention";

export type HarnessCallOptions = {
  /** Project the call runs on behalf of, when there is one (session dispatch). */
  projectId?: string;
  model?: string;
};

/**
 * `owner` is this harness instance's: one per project, or one for host-level calls. Its children
 * with extension lifetime stop when the harness is disposed, on disable, source change or shutdown.
 */
export type HarnessContextFactory = (
  record: RuntimeHarnessRecord,
  options: HarnessCallOptions | undefined,
  owner: ProcessOwner,
) => MaybePromise<HarnessContext>;

export type HarnessHandle = {
  /** Namespaced `${extensionId}.${localId}`. */
  id: string;
  localId: string;
  extensionId: string;
  /** Entry file of the exact registered extension source. */
  sourcePath?: string;
  /** Installed package folder that owns the harness, also when `sourcePath` is a prepared copy. */
  packagePath?: string;
  label: Localizable<string>;
  /** Normalized skill directories when the provider declares them. */
  skills: { dir: string; globalDir: string } | null;
  /** Discrete run params declared by the harness, if any. */
  params: HarnessParamsSchema | null;
  cwdRequirement: "required" | "optional";
  supportsReattach: boolean;
  supportsHistory: boolean;
  supportsFork: boolean;
  /** The harness offers a model choice through `listModels`. */
  supportsModels: boolean;
  supportsCommandState: boolean;
  watchCommandState?(
    input: HarnessCommandDiscoveryContext,
    changed: () => void,
    options?: HarnessCallOptions,
  ): Promise<() => void>;
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
  fork(
    input: HarnessCommandContext & { agentSessionId: string; messageId?: string },
    options?: HarnessCallOptions,
  ): Promise<{ agentSessionId: string }>;
  reattach(input: HarnessReattachInput, options?: HarnessCallOptions): Promise<HarnessSession>;
  getMessages(input: HarnessMessagesInput, options?: HarnessCallOptions): Promise<SessionMessage[]>;
  recoverMessages(input: HarnessRecoveryInput, options?: HarnessCallOptions): Promise<HarnessRecoveryResult>;
  getCommandState(input: HarnessCommandDiscoveryContext, options?: HarnessCallOptions): Promise<HarnessCommandState>;
  prepareOperation(
    input: HarnessCommandContext,
    operation: HarnessOperation,
    options?: HarnessCallOptions,
  ): Promise<PreparedHarnessOperation & { release(): void }>;
  dispose(): Promise<void>;
};

export type HarnessRegistry = {
  get(id: string): HarnessHandle | null;
  list(): HarnessHandle[];
  /** Namespaced ids that appeared more than once; last install won. */
  duplicates: string[];
  dispose(): Promise<void>;
};

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
  const owners = new Map<string | undefined, ProcessOwner>();
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
      const owner = createProcessOwner();
      owners.set(key, owner);
      value = Promise.resolve().then(() => buildContext(record, options, owner));
      contexts.set(key, value);
    }
    const context = await value;
    ensureActive();
    return context;
  };
  const provider = record.provider;
  const authentication = createHarnessAuthenticationLifetime();
  const commandWatches = createHarnessCommandObservations(provider, ctx, () => disposed);
  const retained = createRetainedHarnessCalls(provider, ctx, resources);
  const calls = createHarnessCallOwnership(ctx);
  if (provider.getMessages && !provider.recoverMessages) {
    throw new Error(`Harness with native history must provide recoverMessages: ${record.id}`);
  }
  const params = provider.params ?? null;

  const validateInputParams = async (input: HarnessStartInput | HarnessResumeInput, options?: HarnessCallOptions) => {
    if (!provider.listModels) {
      validateHarnessParams(params, input.params);
      return;
    }

    const models = await calls.once(options, (context) => provider.listModels!(context));
    const model = findAgentModel(models, input.model);
    validateHarnessParams(resolveAgentModelParams(params, model), input.params);
  };

  return {
    id: record.id,
    localId: record.localId,
    extensionId: record.extensionId,
    sourcePath: record.sourcePath,
    packagePath: record.packagePath,
    label: provider.label,
    skills: normalizeSkills(provider.skills),
    params,
    cwdRequirement: provider.cwdRequirement ?? "required",
    supportsReattach: typeof provider.reattach === "function",
    supportsHistory: typeof provider.getMessages === "function",
    supportsFork: typeof provider.fork === "function",
    supportsModels: typeof provider.listModels === "function",
    capabilities: (options) => calls.once(options, (context) => provider.capabilities(context)),
    detect: (options) => calls.once(options, (context) => detectHarness(provider, context)),
    ...(provider.getAuthentication
      ? {
          getAuthentication: (options?: HarnessCallOptions) =>
            calls.once(options, (context) => provider.getAuthentication!(context, { model: options?.model })),
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
            const call = await calls.open(options);
            try {
              await authentication.run(
                channel,
                async (channel) => {
                  await provider.authenticate!(call.context, input, channel);
                },
                call.close,
              );
            } finally {
              call.close();
            }
          },
        }
      : {}),
    listModels: async (options) =>
      provider.listModels ? calls.once(options, (context) => provider.listModels!(context)) : [],
    start: async (input, options) => {
      await validateInputParams(input, options);
      return retained.invoke(
        input,
        options,
        () =>
          calls.until(
            options,
            async (context) => adaptSession(await provider.start(context, input)),
            (run) => run.done,
          ),
        (run) => run.done,
      );
    },
    resume: async (input, options) => {
      await validateInputParams(input, options);
      return retained.invoke(
        input,
        options,
        () =>
          calls.until(
            options,
            async (context) => adaptSession(await provider.resume(context, input)),
            (run) => run.done,
          ),
        (run) => run.done,
      );
    },
    reattach: async (input, options) => {
      if (!provider.reattach) throw new Error(`Harness does not support reattach: ${record.id}`);
      return retained.invoke(
        input,
        options,
        () =>
          calls.until(
            options,
            async (context) => adaptSession(await provider.reattach!(context, input)),
            (run) => run.done,
          ),
        (run) => run.done,
      );
    },
    fork: async (input, options) => {
      if (!provider.fork) throw new Error("This harness does not support forking conversations.");
      return retained.invoke(input, options, () => calls.once(options, (context) => provider.fork!(context, input)));
    },
    getMessages: async (input, options) =>
      provider.getMessages ? calls.once(options, (context) => provider.getMessages!(context, input)) : [],
    recoverMessages: async (input, options) =>
      provider.recoverMessages
        ? calls.once(options, (context) => provider.recoverMessages!(context, input))
        : { kind: "recovered", messages: [...input.knownMessages] },
    supportsCommandState: Boolean(provider.getCommandState),
    watchCommandState: commandWatches.watch,
    getCommandState: async (input, options) =>
      retained.invoke(input, options, async () =>
        provider.getCommandState
          ? calls.once(options, (context) => provider.getCommandState!(context, input))
          : { commands: [], modes: [], slashCommands: false },
      ),
    prepareOperation: createHarnessOperationPreparation({
      provider,
      calls,
      retained,
      ensureActive,
      disposed: () => disposed,
      id: record.id,
    }),
    dispose: () => {
      disposed = true;
      retained.closeAdmission();
      // Publish the shared settlement before any external cleanup can reenter.
      closing ??= Promise.resolve().then(async () => {
        // A sign-in is aborted and its call's children stopped at once, but awaited only after
        // every child of the instance is stopped below: it may be waiting on one of them.
        const signingIn = Promise.resolve().then(() => authentication.dispose());
        const ownership = await Promise.allSettled([Promise.resolve().then(() => commandWatches.dispose())]);
        const admitted = await Promise.allSettled([Promise.resolve().then(() => retained.retire())]);
        const results = await Promise.allSettled(
          [...contexts.values()].map((context) =>
            context.then(
              (value) => provider.dispose?.(value),
              () => undefined,
            ),
          ),
        );
        // Extension-lifetime children end with the instance, after the provider's own cleanup.
        await Promise.all([...owners.values()].map((owner) => owner.close()));
        ownership.push(...(await Promise.allSettled([signingIn])));
        const errors = [...ownership, ...admitted, ...results].flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        );
        if (errors.length) throw new AggregateError(errors, `Harness cleanup failed: ${record.id}`);
      });
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
      const results = await Promise.allSettled(
        [...handles.values()].map((handle) => {
          try {
            return handle.dispose();
          } catch (error) {
            return Promise.reject(error);
          }
        }),
      );
      const errors = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
      if (errors.length) throw new AggregateError(errors, "Harness registry cleanup failed.");
    },
  };
};
