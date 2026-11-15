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
  const turns = new Map<{ stop(): Promise<void> }, string | undefined>();
  const short = <T>(ctx: HarnessContext, action: Parameters<typeof withCopilotClient<T>>[2], cwd?: string) =>
    withCopilotClient(factory, { cwd }, action).catch((error: unknown) => {
      ctx.logger.warn(`GitHub Copilot request failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    });

  const run = async (ctx: HarnessContext, input: CopilotTurnInput) => {
    const session = await startCopilotTurn(input, factory, {
      PSTDIO_SESSION_ID: input.sessionId,
      ...(ctx.projectId ? { PSTDIO_PROJECT_ID: ctx.projectId } : {}),
    });
    turns.set(session, ctx.projectId);
    void session.done.finally(() => turns.delete(session));
    return session;
  };

  return {
    id: "copilot",
    label: l10n("harness.copilot", "GitHub Copilot"),
    skills: { dir: ".github/skills", globalDir: ".copilot/skills" },
    params: {
      permission_mode: {
        control: "command",
        ...params.select({
          label: l10n("params.permissionMode", "Permission mode"),
          defaultValue: "allow-all",
          options: [
            { label: "Allow all", value: "allow-all" },
            { label: "Ask", value: "manual" },
          ],
        }),
      },
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
      withCopilotClient(factory, { signal: channel.signal }, (client) => runLogin(client, input, channel)).catch(
        (error) => {
          ctx.logger.warn("GitHub Copilot sign-in failed.");
          throw error;
        },
      ),
    listModels: async (ctx) => {
      const models = await short(ctx, (client) => client.listModels());
      return models.filter((model) => model.policy?.state !== "disabled").map(toAgentModel);
    },
    start: run,
    resume: run,
    getMessages: (ctx, input) =>
      short(ctx, async (client) => normalizeCopilotEvents(await client.readEvents(input.agentSessionId)), input.cwd),
    fork: (ctx, input) =>
      short(
        ctx,
        async (client) => {
          const boundary = input.messageId
            ? forkBoundary(await client.readEvents(input.agentSessionId), input.messageId)
            : undefined;
          return { agentSessionId: await client.forkSession(input.agentSessionId, boundary) };
        },
        input.cwd,
      ),
    recoverMessages: (_ctx, input) => reconcileMessageHistory(input),
    dispose: async (ctx) => {
      await Promise.all([...turns].filter(([, projectId]) => projectId === ctx.projectId).map(([turn]) => turn.stop()));
    },
  } satisfies Omit<HarnessProvider, "ref">;
};
