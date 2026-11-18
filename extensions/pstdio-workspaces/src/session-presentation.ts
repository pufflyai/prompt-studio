import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";

export const sessionPresentation = defineCommand({
  id: "session-presentation",
  title: l10n("commands.sessionPresentation", "Read session workspace presentation"),
  params: { id: params.text(), existingSession: params.boolean(), available: params.boolean() },
  async run(ctx, input) {
    const selected = input.id ? await ctx.workspaces.get(input.id) : undefined;
    const provisioning = selected?.initializing || selected?.providerState === "provisioning";
    const unavailable = selected?.providerState && selected.providerState !== "ready";
    const summary =
      selected?.capabilities?.diff &&
      !selected.device &&
      selected.executionKind !== "remote" &&
      !provisioning &&
      !unavailable &&
      !selected.setupError
        ? await ctx.workspaces.diffSummary(selected.id, "current").catch(() => undefined)
        : undefined;
    return {
      controlId: "workspace",
      deviceControlId: "device",
      ...(provisioning ? { status: "loading" as const } : {}),
      ...(!provisioning && (selected?.setupError || unavailable)
        ? { status: "error" as const, statusLabel: selected?.setupError ?? "Workspace unavailable" }
        : {}),
      additions: summary?.additions ?? 0,
      deletions: summary?.deletions ?? 0,
      ...(input.existingSession &&
      input.id &&
      selected?.id === input.id &&
      input.available !== false &&
      !provisioning &&
      !unavailable &&
      !selected.setupError
        ? { openResourceId: input.id }
        : {}),
    };
  },
});
