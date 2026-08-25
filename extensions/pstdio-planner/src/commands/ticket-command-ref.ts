import type { CommandContext } from "@pstdio/sdk/extensions";

export const ticketRefFromCommandContext = (ctx: Pick<CommandContext, "resource">, commandParams: { id?: unknown }) => {
  if (ctx.resource?.type === "ticket") return ctx.resource.id;
  return typeof commandParams.id === "string" ? commandParams.id : "";
};
