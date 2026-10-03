import type {
  AgentCapability,
  AgentModel,
  HarnessCommandContext,
  HarnessCommandDiscoveryContext,
  HarnessCommandState,
  HarnessExit,
  HarnessMessagesInput,
  HarnessOperation,
  HarnessParams,
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
  HarnessContext,
  HarnessDetectionResult,
  HarnessParamsSchema,
  HarnessSkillsLayout,
  Localizable,
  MaybePromise,
} from "pstdio-api-contracts/extension-kernel";
import type { RuntimeHarnessRecord } from "pstdio-extensions";

export type HarnessCallOptions = {
  /** Project the call runs on behalf of, when there is one (session dispatch). */
  projectId?: string;
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
  capabilities(options?: HarnessCallOptions): Promise<AgentCapability[]>;
  detect(options?: HarnessCallOptions): Promise<HarnessDetectionResult>;
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

export const defaultHarnessParams = (schema: HarnessParamsSchema | null | undefined) => {
  const values: HarnessParams = {};
  if (!schema) return values;

  for (const [key, descriptor] of Object.entries(schema)) {
    if (descriptor.defaultValue !== undefined) values[key] = descriptor.defaultValue;
  }

  return values;
};

const formatValueList = (values: string[]) => values.map((value) => `"${value}"`).join(", ");

export const validateHarnessParams = (
  schema: HarnessParamsSchema | null | undefined,
  params: HarnessParams | undefined,
) => {
  if (!schema) {
    if (!params || Object.keys(params).length === 0) return;
    throw new Error("Harness does not declare params.");
  }

  validateRequiredHarnessParams(schema, params);

  if (!params || Object.keys(params).length === 0) return;

  validateDeclaredHarnessParams(schema, params);
};

const validateRequiredHarnessParams = (schema: HarnessParamsSchema, params: HarnessParams | undefined) => {
  for (const [key, descriptor] of Object.entries(schema)) {
    if (descriptor.required && !Object.hasOwn(params ?? {}, key)) {
      throw new Error(`Harness param "${key}" is required.`);
    }
  }
};

const validateDeclaredHarnessParams = (schema: HarnessParamsSchema, params: HarnessParams) => {
  for (const [key, value] of Object.entries(params)) {
    const descriptor = schema[key];
    if (!descriptor) throw new Error(`Harness param "${key}" is not declared.`);

    if (descriptor.type === "boolean") {
      if (typeof value !== "boolean") throw new Error(`Harness param "${key}" must be a boolean.`);
      continue;
    }

    const allowed = descriptor.options.map((option) => option.value);
    if (typeof value !== "string" || !allowed.includes(value)) {
      throw new Error(`Harness param "${key}" must be one of ${formatValueList(allowed)}.`);
    }
  }
};

const toHandle = (record: RuntimeHarnessRecord, buildContext: HarnessContextFactory): HarnessHandle => {
  const contexts = new Map<string | undefined, Promise<HarnessContext>>();
  let closing: Promise<void> | undefined;
  let disposed = false;
  const ensureActive = () => {
    if (disposed) throw new Error(`Harness has been disposed: ${record.id}`);
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
    capabilities: async (options) => provider.capabilities(await ctx(options)),
    detect: async (options) => (provider.detect ? provider.detect(await ctx(options)) : { available: true }),
    listModels: async (options) => (provider.listModels ? provider.listModels(await ctx(options)) : []),
    start: async (input, options) => {
      await validateInputParams(input, options);
      return adaptSession(await provider.start(await ctx(options), input));
    },
    resume: async (input, options) => {
      await validateInputParams(input, options);
      return adaptSession(await provider.resume(await ctx(options), input));
    },
    reattach: async (input, options) => {
      if (!provider.reattach) throw new Error(`Harness does not support reattach: ${record.id}`);
      return adaptSession(await provider.reattach(await ctx(options), input));
    },
    getMessages: async (input, options) =>
      provider.getMessages ? provider.getMessages(await ctx(options), input) : [],
    recoverMessages: async (input, options) =>
      provider.recoverMessages
        ? provider.recoverMessages(await ctx(options), input)
        : { kind: "recovered", messages: [...input.knownMessages] },
    getCommandState: async (input, options) =>
      provider.getCommandState
        ? provider.getCommandState(await ctx(options), input)
        : { commands: [], modes: [], slashCommands: false },
    prepareOperation: async (input, operation, options) => {
      if (!provider.prepareOperation) throw new Error("This harness does not support native commands.");
      const context = await ctx(options);
      if (operation.kind === "command" && provider.getCommandState) {
        const state = await provider.getCommandState(context, input);
        const name = /^\/\S+/.exec(operation.text)?.[0];
        const command = state.commands.find((entry) => entry.name === name);
        if (command?.disabledReason) throw new Error(command.disabledReason);
      }
      const prepared = await provider.prepareOperation(context, input, operation);
      ensureActive();
      return {
        execution: prepared.execution,
        invoke: async (invocation) => {
          ensureActive();
          const result = await prepared.invoke(invocation);
          if (result.kind === "started") {
            if (disposed) {
              await result.session.stop();
              throw new Error(`Harness has been disposed: ${record.id}`);
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
): HarnessRegistry => {
  const handles = new Map<string, HarnessHandle>();
  const duplicates: string[] = [];

  for (const record of records) {
    if (handles.has(record.id)) duplicates.push(record.id);
    handles.set(record.id, toHandle(record, buildContext));
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
