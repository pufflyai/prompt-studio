import type { ExtensionDefinition } from "@pstdio/sdk/extensions";

export default {
  commands: [
    {
      id: "counter.bump",
      ref: { kind: "command", id: "counter.bump" },
      title: "Bump counter",
      cli: true,
      params: { amount: { type: "number", defaultValue: 1 } },
      async run(ctx, input) {
        const current = (await ctx.storage.get<number>("counter")) ?? 0;
        const counter = current + Number(input.amount ?? 1);
        await ctx.storage.set("counter", counter);
        return { counter };
      },
    },
    {
      id: "counter.read",
      ref: { kind: "command", id: "counter.read" },
      title: "Read counter",
      cli: true,
      params: {},
      async run(ctx) {
        return { counter: (await ctx.storage.get<number>("counter")) ?? 0 };
      },
    },
  ],
} satisfies ExtensionDefinition;
