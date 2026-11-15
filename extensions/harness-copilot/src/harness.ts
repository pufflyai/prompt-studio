import type { ModelInfo } from "@github/copilot-sdk";
import type { AgentModel, HarnessContext, HarnessProvider } from "@pstdio/sdk/extensions";
import { l10n, params, reconcileMessageHistory } from "@pstdio/sdk/extensions";
import { readAuthentication, runLogin } from "./authentication";
import { type CopilotClientFactory, createCopilotClient, withCopilotClient } from "./client";
import { forkBoundary, normalizeCopilotEvents } from "./events";
import { type CopilotTurnInput, startCopilotTurn } from "./turn";

const reasoningOptions = (efforts: readonly string[]) => [
  { label: "Default", value: "default" },
  ...efforts.map((effort) => ({
    label: effort === "xhigh" ? "XHigh" : effort[0]!.toUpperCase() + effort.slice(1),
    value: effort,
  })),
];

const reasoningParam = (efforts: readonly string[], defaultValue = "default") =>
  params.select({ label: l10n("params.reasoning", "Reasoning"), defaultValue, options: reasoningOptions(efforts) });

export const toAgentModel = (model: ModelInfo): AgentModel => ({
  id: model.id,
  label: model.name,
  paramOverrides: {
    reasoning: model.supportedReasoningEfforts?.length
      ? reasoningParam(model.supportedReasoningEfforts, model.defaultReasoningEffort ?? "default")
      : null,
  },
});

export const createCopilotHarness = (factory: CopilotClientFactory = createCopilotClient) => {
  // Running turns and short requests per project, so dispose can stop them, including ones still starting.
  const operations = new Map<{ stop(): Promise<void> }, string | undefined>();
  const track = <T extends { stop(): Promise<void>; done: Promise<unknown> }>(
    projectId: string | undefined,
    item: T,
  ) => {
    operations.set(item, projectId);
    void item.done.finally(() => operations.delete(item)).catch(() => {});
    return item;
  };

  const short = <T>(
    ctx: HarnessContext,
    action: Parameters<typeof withCopilotClient<T>>[2],
    options: { cwd?: string; signal?: AbortSignal } = {},
  ) => {
    const controller = new AbortController();
    const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
    const done = withCopilotClient(factory, { cwd: options.cwd, signal }, action);
    track(ctx.projectId, {
      done,
      stop: async () => {
        controller.abort();
        await done.catch(() => {});
      },
    });
    return done.catch((error: unknown) => {
      ctx.logger.warn(`GitHub Copilot request failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    });
  };

  const run = (ctx: HarnessContext, input: CopilotTurnInput) =>
    track(
      ctx.projectId,
      startCopilotTurn(input, factory, {
        PSTDIO_SESSION_ID: input.sessionId,
        ...(ctx.projectId ? { PSTDIO_PROJECT_ID: ctx.projectId } : {}),
      }),
    ).session;

  return {
    id: "copilot",
    label: l10n("harness.copilot", "GitHub Copilot"),
    skills: { dir: ".github/skills", globalDir: ".copilot/skills" },
    params: {
      permission_mode: params.select({
        label: l10n("params.permissionMode", "Permission mode"),
        defaultValue: "allow-all",
        options: [
          { label: "Allow all", value: "allow-all" },
          { label: "Ask", value: "manual" },
        ],
      }),
      reasoning: reasoningParam(["low", "medium", "high", "xhigh", "max"]),
    },
    capabilities: () => ["Approvals", "Attachments", "SessionFork"],
    detect: async (ctx) => {
      try {
        const status = await short(ctx, (client) => client.getStatus());
        return { available: true, version: status.version };
      } catch (error) {
        return {
          available: false,
          reason: `The bundled Copilot runtime did not start: ${error instanceof Error ? error.message : error}`,
        };
      }
    },
    getAuthentication: async (ctx) => {
      try {
        return await short(ctx, readAuthentication);
      } catch {
        return { status: "unknown", providers: [] };
      }
    },
    authenticate: (ctx, input, channel) =>
      short(ctx, (client) => runLogin(client, input, channel), { signal: channel.signal }),
    listModels: async (ctx) => {
      // Copilot refuses to list models before sign-in; an empty list lets the model menu offer sign-in.
      const models = await short(ctx, async (client) =>
        (await client.getAuthStatus()).isAuthenticated ? client.listModels() : [],
      );
      return models.filter((model) => model.policy?.state !== "disabled").map(toAgentModel);
    },
    start: run,
    resume: run,
    getMessages: (ctx, input) =>
      short(ctx, async (client) => normalizeCopilotEvents(await client.readEvents(input.agentSessionId)), {
        cwd: input.cwd,
      }),
    fork: (ctx, input) =>
      short(
        ctx,
        async (client) => {
          const boundary = input.messageId
            ? forkBoundary(await client.readEvents(input.agentSessionId), input.messageId)
            : undefined;
          return { agentSessionId: await client.forkSession(input.agentSessionId, boundary) };
        },
        { cwd: input.cwd },
      ),
    recoverMessages: (_ctx, input) => reconcileMessageHistory(input),
    dispose: async (ctx) => {
      await Promise.all(
        [...operations].filter(([, projectId]) => projectId === ctx.projectId).map(([operation]) => operation.stop()),
      );
    },
  } satisfies Omit<HarnessProvider, "ref">;
};
