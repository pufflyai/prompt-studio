import type { HookResponse } from "@pstdio/sdk/plugins";

// biome-ignore lint/suspicious/noConfusingVoidType: handlers may return void (post-hooks) or HookResponse (pre-hooks)
export type HookHandler = (ctx: unknown) => HookResponse | void | Promise<HookResponse | void>;

export type PreHookResult = { rejected: boolean; reason?: string; data?: Record<string, unknown> };

export const createHookDispatcher = () => {
  const handlers = new Map<string, HookHandler[]>();

  const getHandlers = (hookName: string) => handlers.get(hookName) ?? [];

  return {
    register(hookName: string, handler: HookHandler) {
      const list = handlers.get(hookName);
      if (list) {
        list.push(handler);
      } else {
        handlers.set(hookName, [handler]);
      }
    },

    async firePreHook(hookName: string, ctx: unknown): Promise<PreHookResult> {
      let merged: Record<string, unknown> | undefined;

      for (const handler of getHandlers(hookName)) {
        try {
          const result = await handler(ctx);
          if (result?.reject) {
            return { rejected: true, reason: result.reason };
          }
          if (result?.data) {
            merged = { ...merged, ...result.data };
          }
        } catch (error) {
          return { rejected: true, reason: error instanceof Error ? error.message : String(error) };
        }
      }
      return merged ? { rejected: false, data: merged } : { rejected: false };
    },

    async firePostHook(hookName: string, ctx: unknown): Promise<void> {
      await Promise.allSettled(
        getHandlers(hookName).map(async (handler) => {
          await handler(ctx);
        }),
      );
    },
  };
};
