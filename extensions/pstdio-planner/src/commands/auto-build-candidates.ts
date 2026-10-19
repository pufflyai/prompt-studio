import { type CommandContext, defineCommand, l10n } from "@pstdio/sdk/extensions";
import { type AutoBuildMode, readAutoBuildMode } from "../data/auto-build-mode";
import { readNextTickets } from "./next-tickets";

export async function readAutoBuildCandidates(
  ctx: CommandContext,
  mode: AutoBuildMode,
  input: { limit?: number } = {},
) {
  const { tickets, waiting, capacity, snapshot, completed, matchingTicketCount, observations, configurationError } =
    await readNextTickets(ctx, mode, input);
  const blockedTickets = waiting
    .filter(({ reason }) => reason !== "assigned" && reason !== "existing-attempt" && reason !== "capacity-full")
    .map(({ ticket }) => ticket);
  return {
    candidates: tickets.filter(({ action }) => action !== "update-stack"),
    capacity,
    snapshot,
    blockedTickets,
    completed,
    matchingTicketCount,
    observations,
    configurationError,
  };
}

/** @deprecated Use next-tickets (`pst tickets next`) for scoped work and waiting reasons. */
export const autoBuildCandidatesCommand = defineCommand({
  id: "auto-build.candidates",
  title: "Read Auto Build candidates",
  description: l10n(
    "autoBuild.candidates.deprecated",
    "Deprecated in 0.44. Use pst tickets next for scoped work and waiting reasons. Removed in 0.45.",
  ),
  cli: true,
  async run(ctx) {
    const mode = await readAutoBuildMode(ctx);
    const { candidates, capacity } = await readAutoBuildCandidates(ctx, mode);
    return { enabled: mode.enabled, revision: mode.revision, candidates, capacity };
  },
});
