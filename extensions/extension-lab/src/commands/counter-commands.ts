import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { COUNTER_STORAGE_KEY, LAB_ROUTE_HEADER_WHEN } from "../utils/lab-constants";

export const bumpCounterCommand = defineCommand({
  title: l10n("commands.counter.bump.title", "Bump lab counter"),
  cli: true,
  menus: [
    {
      target: "workbench.nav.overflow",
      label: l10n("commands.counter.bump.title", "Bump lab counter"),
      icon: "plus",
      when: LAB_ROUTE_HEADER_WHEN,
    },
    {
      target: "workbench.commandPalette",
      group: "Lab",
      label: l10n("commands.counter.bump.title", "Bump lab counter"),
    },
  ],
  params: { amount: params.number({ defaultValue: 1 }) },
  async run(ctx) {
    const { amount = 1 } = ctx.params;
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
  title: l10n("commands.counter.read.title", "Read lab counter"),
  cli: true,
  menus: [
    {
      target: "workbench.commandPalette",
      group: "Lab",
      label: l10n("commands.counter.read.title", "Read lab counter"),
      icon: "badge-info",
    },
  ],
  async run(ctx) {
    return { counter: (await ctx.storage.get<number>(COUNTER_STORAGE_KEY)) ?? 0 };
  },
});

export const resetCounterCommand = defineCommand({
  title: l10n("commands.counter.reset.title", "Reset lab counter"),
  cli: true,
  menus: [
    {
      target: "workbench.nav.overflow",
      label: l10n("commands.counter.reset.title", "Reset lab counter"),
      icon: "rotate-ccw",
      when: LAB_ROUTE_HEADER_WHEN,
    },
    {
      target: "workbench.commandPalette",
      group: "Lab",
      label: l10n("commands.counter.reset.title", "Reset lab counter"),
    },
  ],
  async run(ctx) {
    await ctx.storage.set(COUNTER_STORAGE_KEY, 0);
    return { counter: 0 };
  },
});
