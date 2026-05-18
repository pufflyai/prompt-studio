import type { CommandContext, CommandInvocation, CommandMiddlewareResult, JsonObject } from "@pstdio/sdk/extensions";
import type { RuntimeMiddlewareRecord } from "../../types/runtime";

export type MiddlewareChainResult =
  | { status: "continue"; invocation: CommandInvocation }
  | { status: "reject"; rejection: { code?: string; reason: string; data?: JsonObject } };

export const runMiddlewareChain = async (
  middlewares: RuntimeMiddlewareRecord[],
  initialInvocation: CommandInvocation,
  buildCtx: (
    invocation: CommandInvocation,
    middleware: RuntimeMiddlewareRecord,
  ) => Promise<CommandContext> | CommandContext,
): Promise<MiddlewareChainResult> => {
  let invocation = initialInvocation;

  for (const mw of middlewares) {
    const ctx = await buildCtx(invocation, mw);
    let result: CommandMiddlewareResult;
    try {
      result = (await mw.handler(ctx)) as CommandMiddlewareResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: "reject",
        rejection: { code: "middleware_failed", reason: `Middleware "${mw.id}" threw: ${message}` },
      };
    }

    if (!result || result.type === "continue") continue;

    if (result.type === "reject") {
      return {
        status: "reject",
        rejection: { code: result.code, reason: result.reason, data: result.data },
      };
    }

    if (result.type === "patchParams") {
      invocation = { ...invocation, params: { ...invocation.params, ...(result.params as JsonObject) } };
      continue;
    }

    if (result.type === "replaceParams") {
      invocation = { ...invocation, params: result.params as JsonObject };
      continue;
    }

    if (result.type === "replaceInvocation") {
      invocation = result.invocation as CommandInvocation;
    }
  }

  return { status: "continue", invocation };
};
