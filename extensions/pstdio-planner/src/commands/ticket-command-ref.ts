import type { CommandContext } from "@pstdio/sdk/extensions";

export const ticketRefFromCommandContext = (ctx: Pick<CommandContext, "params" | "resource">) => {
  if (ctx.resource?.type === "ticket") return ctx.resource.id;
  const params = ctx.params as { id?: unknown };
  return typeof params.id === "string" ? params.id : "";
};
