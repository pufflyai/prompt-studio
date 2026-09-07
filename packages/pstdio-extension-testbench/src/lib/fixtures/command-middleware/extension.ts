import { defineCommand, defineExtension, defineMiddleware, params } from "@pstdio/sdk/extensions";

const execute = defineCommand({
  id: "execute",
  title: "Execute",
  params: { title: params.text() },
  async run(ctx, input) {
    const executions = ((await ctx.storage.get<number>("executions")) ?? 0) + 1;
    await ctx.storage.set("executions", executions);
    return { title: input.title, executions };
  },
});

const rejectBlockedTitle = defineMiddleware({
  id: "reject-blocked-title",
  command: execute.ref,
  run(ctx, input) {
    if (input.title === "blocked") {
      return ctx.commands.reject({ code: "title_blocked", reason: "This title is blocked." });
    }
  },
});

export default defineExtension({ commands: [execute], middlewares: [rejectBlockedTitle] });
