import type {
  AgentCapability,
  AgentModel,
  HarnessExit,
  HarnessMessagesInput,
  HarnessParams,
  HarnessReattachInput,
  HarnessResumeInput,
  HarnessSession,
  HarnessStartInput,
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
  supportsReattach: boolean;
  capabilities(options?: HarnessCallOptions): Promise<AgentCapability[]>;
  detect(options?: HarnessCallOptions): Promise<HarnessDetectionResult>;
  listModels(options?: HarnessCallOptions): Promise<AgentModel[]>;
  start(input: HarnessStartInput, options?: HarnessCallOptions): Promise<HarnessSession>;
  resume(input: HarnessResumeInput, options?: HarnessCallOptions): Promise<HarnessSession>;
  reattach(input: HarnessReattachInput, options?: HarnessCallOptions): Promise<HarnessSession>;
  getMessages(input: HarnessMessagesInput, options?: HarnessCallOptions): Promise<SessionMessage[]>;
};

export type HarnessRegistry = {
  get(id: string): HarnessHandle | null;
  list(): HarnessHandle[];
  /** Namespaced ids that appeared more than once; last install won. */
  duplicates: string[];
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
  const ctx = (options?: HarnessCallOptions) => Promise.resolve(buildContext(record, options));
  const provider = record.provider;
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
    supportsReattach: typeof provider.reattach === "function",
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
  };
};
