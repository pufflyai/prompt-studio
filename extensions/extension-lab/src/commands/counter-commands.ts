import { defineCommand, l10n, params, projectSlots } from "@pstdio/sdk/extensions";
import { COUNTER_STORAGE_KEY, LAB_ROUTE_HEADER_WHEN } from "../utils/lab-constants";

export const bumpCounterCommand = defineCommand({
  id: "counter.bump",
  title: l10n("commands.counter.bump.title", "Bump lab counter"),
  cli: true,
  palette: [{ group: "Lab", label: l10n("commands.counter.bump.title", "Bump lab counter") }],
  menus: [
    {
      slot: projectSlots.headerOverflow,
      label: l10n("commands.counter.bump.title", "Bump lab counter"),
      icon: "plus",
      when: LAB_ROUTE_HEADER_WHEN,
    },
  ],
  params: { amount: params.number({ defaultValue: 1 }) },
  async run(ctx, commandParams) {
    const { amount = 1 } = commandParams;
    const enabled = ((await ctx.settings.get("counter.enabled")) ?? true) as boolean;
    const current = (await ctx.storage.get<number>(COUNTER_STORAGE_KEY)) ?? 0;
    if (!enabled) return { counter: current, enabled };
    const step = ((await ctx.settings.get("counter.step")) ?? 1) as number;
    const next = current + step * amount;
    await ctx.storage.set(COUNTER_STORAGE_KEY, next);
    return { counter: next };
  },
});

export const readCounterCommand = defineCommand({
  id: "counter.read",
  title: l10n("commands.counter.read.title", "Read lab counter"),
  cli: true,
  async run(ctx, _commandParams) {
    return { counter: (await ctx.storage.get<number>(COUNTER_STORAGE_KEY)) ?? 0 };
  },
});

export const resetCounterCommand = defineCommand({
  id: "counter.reset",
  title: l10n("commands.counter.reset.title", "Reset lab counter"),
  cli: true,
  palette: [{ group: "Lab", label: l10n("commands.counter.reset.title", "Reset lab counter") }],
  menus: [
    {
      slot: projectSlots.headerOverflow,
      label: l10n("commands.counter.reset.title", "Reset lab counter"),
      icon: "rotate-ccw",
      when: LAB_ROUTE_HEADER_WHEN,
    },
  ],
  async run(ctx, _commandParams) {
    await ctx.storage.set(COUNTER_STORAGE_KEY, 0);
    return { counter: 0 };
  },
});
