import type { HarnessContext, HarnessProvider } from "@pstdio/sdk/extensions";
import { l10n, params } from "@pstdio/sdk/extensions";
import { authenticateOpencode } from "./account-action";
import { opencodeCommandState, prepareOpencodeOperation } from "./commands";
import { detectOpencode } from "./detection";
import { recoverOpencodeMessages } from "./history-reconciliation";
import { parseOpencodeModels } from "./models";
import { createOpencodeHarnessService } from "./opencode-harness-service";
import { normalizeOpencodeMessage } from "./opencode-normalizer";
import { resumeOpencodeQuestion } from "./opencode-question-session";
import type { createOpencodeService } from "./opencode-service";
import { toHarnessSession } from "./opencode-session-handle";
import { pollOpencodeMessages, pollOpencodeUntilIdle } from "./opencode-session-poller";

// --- Detection ---

const readOpencodeModels = async (ctx: HarnessContext) => {
  const args = ["api", "GET", "/api/model", "--standalone"];
  const result = await ctx.process.run({ command: [resolveOpencodeCommand(), ...args] });
  // Native API output may contain provider credentials. Never include it in diagnostics.
  if (result.exitCode !== 0) throw new Error("OpenCode model command failed. Check the OpenCode installation.");
  return result.stdout.trim();
};

type OpencodeHarnessDeps = {
  detect: NonNullable<HarnessProvider["detect"]>;
  getModelsOutput: (ctx: HarnessContext, version?: string) => Promise<string>;
  // Tests shorten the session poll interval; the pollers own the default.
  pollIntervalMs?: number;
};

const opencodeParams = {
  variant: params.select({
    label: "Thinking",
    defaultValue: "medium",
    options: [
      { label: "None", value: "none", icon: "CircleSlash" },
      { label: "Minimal", value: "minimal", icon: "level-low" },
      { label: "Low", value: "low", icon: "level-low" },
      { label: "Medium", value: "medium", icon: "level-mid" },
      { label: "High", value: "high", icon: "level-high" },
      { label: "XHigh", value: "xhigh", icon: "level-xhigh" },
      { label: "Max", value: "max", icon: "flame" },
    ],
  }),
};

const MODEL_CACHE_TTL_MS = 5 * 60 * 1_000;

// One diagnostic per running turn, even when the provider streams many snapshots.
const historyRecoveryLogger = (ctx: HarnessContext, sessionId: string) => {
  let reported = false;
  return () => {
    if (reported) return;
    reported = true;
    ctx.logger.warn(
      `OpenCode history recovered for session ${sessionId}: retained saved turns with ambiguous metadata ownership.`,
    );
  };
};

// --- Factory ---

export const createOpencodeHarness = (
  overrides: Partial<OpencodeHarnessDeps> = {},
  serviceOverrides: Parameters<typeof createOpencodeService>[0] = {},
): Omit<HarnessProvider, "ref"> => {
  const deps = { detect: detectOpencode, ...overrides };
  const services = createOpencodeHarnessService(serviceOverrides);
  const serviceFor = services.get;
  let modelCache: { expiresAt: number; value: Promise<ReturnType<typeof parseOpencodeModels>> } | undefined;

  const getModelsOutput =
    deps.getModelsOutput ??
    ((ctx: HarnessContext, version?: string) => {
      const number = version?.match(/\d+\.\d+\.\d+/)?.[0] ?? "";
      if (!Bun.semver.satisfies(number, ">=2.4.0")) return readOpencodeModels(ctx);
      return services.run(ctx, async (signal) => (await serviceFor(ctx)).getModelCatalog(signal));
    });

  const listModels = async (ctx: HarnessContext) => {
    const detection = await deps.detect(ctx);
    if (!detection.available) return [];
    if (modelCache && modelCache.expiresAt > Date.now()) return modelCache.value;

    const value = getModelsOutput(ctx, detection.version)
      .then(parseOpencodeModels)
      .catch(() => {
        modelCache = undefined;
        ctx.logger.warn("OpenCode model discovery failed. Check the OpenCode installation and provider configuration.");
        return [];
      });
    modelCache = { expiresAt: Date.now() + MODEL_CACHE_TTL_MS, value };
    return value;
  };

  const fetchBaselineCount = async (ctx: HarnessContext, sessionId: string, cwd: string | undefined) => {
    try {
      const opencode = await serviceFor(ctx);
      const existing = await opencode.getSessionMessages(sessionId, cwd);
      return existing.length;
    } catch {
      return 0;
    }
  };

  return {
    id: "opencode",
    label: l10n("harness.opencode", "OpenCode"),
    skills: { dir: ".agents/skills" },
    params: opencodeParams,

    capabilities: () => ["SessionFork", "ContextUsage", "SessionReattach"],
    detect: (ctx) => deps.detect(ctx),
    getAuthentication: (ctx, input) => services.run(ctx, async () => (await serviceFor(ctx)).getAuthentication(input)),
    authenticate: async (ctx, input, channel) => {
      await authenticateOpencode(ctx, input, channel, serviceOverrides);
      await services.invalidateAuthentication();
      modelCache = undefined;
    },

    listModels,
    fork: (ctx, input) =>
      services.run(ctx, async (signal) => ({
        agentSessionId: await (await serviceFor(ctx)).forkSession(
          input.agentSessionId,
          input.cwd,
          signal,
          input.messageId,
        ),
      })),
    getCommandState: (ctx, input) =>
      services.run(ctx, async (signal) => opencodeCommandState(input, await serviceFor(ctx), signal)),
    prepareOperation: async (ctx, input, operation) => {
      const prepared = prepareOpencodeOperation(input, operation, await serviceFor(ctx));
      return {
        ...prepared,
        invoke: (invocation) =>
          services.run(ctx, async (signal) => {
            const result = await prepared.invoke({
              ...invocation,
              signal: invocation.signal ? AbortSignal.any([signal, invocation.signal]) : signal,
            });
            if (result.kind === "started") await services.track(ctx, result.session);
            return result;
          }),
      };
    },
    dispose: services.dispose,

    start: (ctx, input) =>
      services.run(ctx, async (signal) => {
        const opencode = await serviceFor(ctx);
        const { sessionId, messageComplete } = await opencode.startSession({
          signal,
          prompt: input.prompt,
          attachments: input.attachments,
          model: input.model,
          params: input.params,
          cwd: input.cwd,
        });

        const abortController = new AbortController();
        const done = pollOpencodeMessages({
          loadMessages: opencode.getSessionMessages,
          sessionId,
          cwd: input.cwd,
          events: input.events,
          onHistoryRecovery: historyRecoveryLogger(ctx, sessionId),
          baselineCount: 0,
          messageComplete,
          abortSignal: abortController.signal,
          pollIntervalMs: deps.pollIntervalMs,
        });

        return services.track(
          ctx,
          toHarnessSession({
            agentSessionId: sessionId,
            abortController,
            abortSession: () => opencode.abortSession(sessionId, input.cwd),
            done,
          }),
        );
      }),

    resume: (ctx, input) =>
      services.run(ctx, async (signal) => {
        const opencode = await serviceFor(ctx);
        if (input.questionResponse) {
          return services.track(
            ctx,
            await resumeOpencodeQuestion({
              opencode,
              input,
              questionResponse: input.questionResponse,
              signal,
              pollIntervalMs: deps.pollIntervalMs,
              onHistoryRecovery: historyRecoveryLogger(ctx, input.agentSessionId),
            }),
          );
        }

        const baselineCount = await fetchBaselineCount(ctx, input.agentSessionId, input.cwd);

        const { messageComplete } = opencode.sendSessionMessage({
          signal,
          sessionId: input.agentSessionId,
          prompt: input.prompt,
          attachments: input.attachments,
          model: input.model,
          params: input.params,
          cwd: input.cwd,
        });
        const abortController = new AbortController();
        const done = pollOpencodeMessages({
          loadMessages: opencode.getSessionMessages,
          sessionId: input.agentSessionId,
          cwd: input.cwd,
          events: input.events,
          onHistoryRecovery: historyRecoveryLogger(ctx, input.agentSessionId),
          baselineCount,
          messageComplete,
          abortSignal: abortController.signal,
          pollIntervalMs: deps.pollIntervalMs,
        });

        return services.track(
          ctx,
          toHarnessSession({
            agentSessionId: input.agentSessionId,
            abortController,
            abortSession: () => opencode.abortSession(input.agentSessionId, input.cwd),
            done,
          }),
        );
      }),

    reattach: (ctx, input) =>
      services.run(ctx, async () => {
        const opencode = await serviceFor(ctx);
        const abortController = new AbortController();
        const done = pollOpencodeUntilIdle({
          loadMessages: opencode.getSessionMessages,
          sessionId: input.agentSessionId,
          cwd: input.cwd,
          events: input.events,
          onHistoryRecovery: historyRecoveryLogger(ctx, input.agentSessionId),
          abortSignal: abortController.signal,
          pollIntervalMs: deps.pollIntervalMs,
        });

        return services.track(
          ctx,
          toHarnessSession({
            agentSessionId: input.agentSessionId,
            abortController,
            abortSession: () => opencode.abortSession(input.agentSessionId, input.cwd),
            done,
          }),
        );
      }),

    getMessages: (ctx, input) =>
      services.run(ctx, async () => {
        const opencode = await serviceFor(ctx);
        const messages = await opencode.getSessionMessages(input.agentSessionId, input.cwd);
        return messages.map(normalizeOpencodeMessage);
      }),
    recoverMessages: (_ctx, input) => recoverOpencodeMessages(input),
  };
};

import { resolveOpencodeCommand } from "./cli";
