import { type CommandContext, defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { listAttempts } from "../data/attempt-storage";
import { findTicket } from "../data/resolve";
import { resolveTicketAnchor } from "./ticket-actions";

interface LinkParams {
  id: string;
  workspace?: string;
  session?: string;
}

const changeLink = async (ctx: CommandContext, input: LinkParams, unlink: boolean) => {
  if (Boolean(input.workspace) === Boolean(input.session)) {
    throw new Error("Exactly one of --workspace and --session is required.");
  }
  const ticket = await findTicket(ctx.storage, input.id);
  if (!ticket) throw new Error(`Unknown ticket "${input.id}"`);

  const workspace = input.workspace
    ? ((await ctx.workspaces.getByShorthand(input.workspace)) ?? (await ctx.workspaces.get(input.workspace)))
    : null;
  const session = input.session ? await ctx.sessions.get(input.session) : null;
  if (input.workspace && !workspace) throw new Error(`Unknown workspace "${input.workspace}"`);
  if (input.session && !session) throw new Error(`Unknown session "${input.session}"`);
  const target = workspace ?? session!;
  const api = workspace ? ctx.workspaces : ctx.sessions;

  if (unlink) {
    const managed = (await listAttempts(ctx.storage)).some((attempt) => {
      if (attempt.ticketId !== ticket.id) return false;
      if (workspace) return attempt.workspaceId === workspace.id;
      return (
        attempt.implementationSessionId === target.id ||
        attempt.revisions.some((revision) => revision.reviews.some((review) => review.sessionId === target.id))
      );
    });
    if (managed)
      throw new Error(`${input.workspace ?? input.session} belongs to the managed attempt for ${ticket.shorthand}.`);
    await api.removeAnchors(target.id, [{ type: "ticket", id: ticket.id }]);
  } else {
    const { anchor } = await resolveTicketAnchor(ctx, ticket.id);
    await api.addAnchors(target.id, [{ ...anchor, role: "context" }]);
  }

  return workspace
    ? {
        ticket: ticket.shorthand,
        workspace: {
          id: workspace.id,
          workspace_shorthand: workspace.workspace_shorthand,
          worktree_path: workspace.worktree_path,
        },
      }
    : { ticket: ticket.shorthand, session: { id: target.id, title: session?.title } };
};

const linkParams = { id: params.text({ required: true }), workspace: params.text(), session: params.text() };

export const linkTicketCommand = defineCommand({
  id: "link",
  title: l10n("commands.linkTicket", "Link ticket"),
  mutating: true,
  cli: { globalAliases: [["tickets", "link"]], examples: ["pst tickets link --id PS-1 --workspace WS-19"] },
  params: linkParams,
  run: (ctx, input) => changeLink(ctx, input, false),
});

export const unlinkTicketCommand = defineCommand({
  id: "unlink",
  title: l10n("commands.unlinkTicket", "Unlink ticket"),
  mutating: true,
  cli: { globalAliases: [["tickets", "unlink"]], examples: ["pst tickets unlink --id PS-1 --session <session-id>"] },
  params: linkParams,
  run: (ctx, input) => changeLink(ctx, input, true),
});
