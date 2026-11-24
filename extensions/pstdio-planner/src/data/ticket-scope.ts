import type { CommandContext, StoragePredicate } from "@pstdio/sdk/extensions";
import { readTagDefinitions } from "./definition-query";
import { requireTickets, resolveStatusId, resolveTagOptionIds } from "./resolve";

export const ticketHasTag = (tag: string, option: string): StoragePredicate => ({
  test: {
    each: { get: { field: "tags" }, key: tag },
    as: "option",
    mode: "some",
    where: { op: "eq", args: [{ variable: "option" }, { literal: option }] },
  },
});

export const ticketScopePredicate = async (
  ctx: CommandContext,
  input: { status?: string; tags?: string[]; parent?: string },
) => {
  const all: StoragePredicate[] = [];
  if (input.status) all.push({ field: "statusId", op: "eq", value: await resolveStatusId(ctx.storage, input.status) });
  if (input.parent)
    all.push({ field: "parentId", op: "in", value: (await requireTickets(ctx, input.parent)).map(({ id }) => id) });
  if (input.tags?.length) {
    const [options, tags] = await Promise.all([
      resolveTagOptionIds(ctx.storage, input.tags),
      readTagDefinitions(ctx.storage),
    ]);
    for (const option of options)
      all.push({
        any: tags
          .filter(({ options }) => options.some(({ id }) => id === option))
          .map(({ id }) => ticketHasTag(id, option)),
      });
  }
  return { all } satisfies StoragePredicate;
};
