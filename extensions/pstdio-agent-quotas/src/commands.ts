import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { readQuotaStatus, selectProvider } from "./quotas";

export const commands = {
  status: defineCommand({
    id: "status",
    title: l10n("commands.status", "Show agent quotas"),
    description: l10n(
      "commands.status.description",
      "Remaining 5-hour and weekly allowance of the selected agent, and the agents to choose from. Reuses a snapshot younger than five minutes.",
    ),
    cli: true,
    params: { refresh: params.boolean({ required: false }) },
    run: (ctx, input) => readQuotaStatus(ctx, input.refresh === true),
  }),
  refresh: defineCommand({
    id: "refresh",
    title: l10n("commands.refresh", "Refresh agent quotas"),
    cli: true,
    palette: [{ group: "Agent Quotas", label: l10n("commands.refresh", "Refresh agent quotas") }],
    run: (ctx) => readQuotaStatus(ctx, true),
  }),
  select: defineCommand({
    id: "select",
    title: l10n("commands.select", "Choose the agent shown in the status bar"),
    description: l10n(
      "commands.select.description",
      "Provider ids: harness-claude-code, harness-codex, harness-copilot, harness-open-code, harness-pi.",
    ),
    cli: true,
    params: { provider: params.text({ required: true }) },
    run: (ctx, input) => selectProvider(ctx, input.provider),
  }),
};
