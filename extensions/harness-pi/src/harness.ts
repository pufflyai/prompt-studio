import type { AgentModel, HarnessContext, HarnessProvider, HarnessStartInput } from "@pstdio/sdk/extensions";
import { l10n, params, reconcileMessageHistory } from "@pstdio/sdk/extensions";
import { getPiAuthentication, runPiAccountWorker } from "./authentication";
import { detectPi, requirePiCommand } from "./detection";
import { readPiHistory } from "./history";
import { type PiProcessOptions, piRequest } from "./process";
import { startPiTurn } from "./turn";

export const createPiHarness = (options: PiProcessOptions = {}) => {
  const operations = new Map<{ stop(): Promise<void> }, string | undefined>();
  const run = (ctx: HarnessContext, input: HarnessStartInput & { agentSessionId?: string }) => {
    input.signal?.throwIfAborted();
    return request(ctx, async (signal) => {
      const command = await requirePiCommand(ctx, { ...options, cwd: input.cwd, signal });
      input.signal?.throwIfAborted();
      const turn = startPiTurn(input, {
        ...command,
        env: {
          ...command.env,
          PSTDIO_SESSION_ID: input.sessionId,
          ...(ctx.projectId ? { PSTDIO_PROJECT_ID: ctx.projectId } : {}),
        },
      });
      operations.set(turn, ctx.projectId);
      void turn.done.finally(() => operations.delete(turn)).catch(() => {});
      return turn.session;
    });
  };
  const request = async <T>(ctx: HarnessContext, action: (signal: AbortSignal) => Promise<T>) => {
    const controller = new AbortController();
    const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
    const done = action(signal);
    const operation = {
      stop: async () => {
        controller.abort();
        await done.catch(() => {});
      },
    };
    operations.set(operation, ctx.projectId);
    try {
      return await done;
    } finally {
      operations.delete(operation);
    }
  };
  return {
    id: "pi",
    label: l10n("harness.pi", "Pi"),
    skills: { dir: ".pi/skills", globalDir: ".pi/agent/skills" },
    params: {
      thinking: params.select({
        label: l10n("params.thinking", "Thinking"),
        defaultValue: "medium",
        options: [
          { label: "Off", value: "off" },
          { label: "Minimal", value: "minimal" },
          { label: "Low", value: "low" },
          { label: "Medium", value: "medium" },
          { label: "High", value: "high" },
          { label: "XHigh", value: "xhigh" },
        ],
      }),
    },
    capabilities: () => [],
    detect: (ctx) => detectPi(ctx, options),
    getAuthentication: (ctx, input) => getPiAuthentication(ctx, input, options),
    authenticate: (ctx, input, channel) =>
      request(ctx, (signal) =>
        runPiAccountWorker({ type: "authenticate", input }, { ...options, signal }, channel),
      ).then(() => {}),
    listModels: (ctx) =>
      request(ctx, async (signal) => {
        if (!(await detectPi(ctx, options)).available) return [];
        signal.throwIfAborted();
        const data = await piRequest("get_available_models", ["--no-session"], { ...options, signal });
        const models = data.models as Array<{ provider: string; id: string; name: string; reasoning: boolean }>;
        return models.map(
          (model) =>
            ({
              id: `${model.provider}/${model.id}`,
              label: model.name,
              paramOverrides: model.reasoning ? undefined : { thinking: null },
            }) satisfies AgentModel,
        );
      }),
    start: run,
    resume: (ctx, input) => run(ctx, input),
    getMessages: (ctx, input) =>
      request(ctx, async (signal) => {
        const command = await requirePiCommand(ctx, { ...options, signal, cwd: input.cwd });
        const data = await piRequest("get_state", ["--session", input.agentSessionId], command);
        if (typeof data.sessionFile !== "string") throw new Error("Pi did not return its session history file.");
        return readPiHistory(data.sessionFile);
      }),
    recoverMessages: (_ctx, input) => reconcileMessageHistory(input),
    dispose: async (ctx) => {
      await Promise.all(
        [...operations].filter(([, projectId]) => projectId === ctx.projectId).map(([operation]) => operation.stop()),
      );
    },
  } satisfies Omit<HarnessProvider, "ref">;
};
