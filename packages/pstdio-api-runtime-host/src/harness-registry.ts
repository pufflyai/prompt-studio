import type { HarnessContext, HarnessDetectionResult, Localizable, MaybePromise } from "@pstdio/sdk/extensions";
import type {
  AgentCapability,
  AgentModel,
  HarnessExit,
  HarnessMessagesInput,
  HarnessReattachInput,
  HarnessResumeInput,
  HarnessSession,
  HarnessStartInput,
  SessionMessage,
} from "pstdio-api-contracts";
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

const toHandle = (record: RuntimeHarnessRecord, buildContext: HarnessContextFactory): HarnessHandle => {
  const ctx = (options?: HarnessCallOptions) => Promise.resolve(buildContext(record, options));
  const provider = record.provider;

  return {
    id: record.id,
    localId: record.localId,
    extensionId: record.extensionId,
    label: provider.label,
    supportsReattach: typeof provider.reattach === "function",
    capabilities: async (options) => provider.capabilities(await ctx(options)),
    detect: async (options) => (provider.detect ? provider.detect(await ctx(options)) : { available: true }),
    listModels: async (options) => (provider.listModels ? provider.listModels(await ctx(options)) : []),
    start: async (input, options) => adaptSession(await provider.start(await ctx(options), input)),
    resume: async (input, options) => adaptSession(await provider.resume(await ctx(options), input)),
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
