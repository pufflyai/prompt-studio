import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { buildTicketAttributes } from "../../data/mappers";
import { migratePlannerStorage } from "../../data/migrate-storage";
import { readTicketStatuses } from "../../data/status-operations";
import { readTicketTags } from "../../data/tag-operations";
import { timelineTicketAttributes } from "../model/ticket-properties";
import { readStoredPlan } from "./plan-store";

// The hidden board exists only for saved-view fields. See ADR 0125.
export async function timelineViewSchema(ctx: Pick<ExtensionContextBase, "storage" | "files">) {
  await migratePlannerStorage(ctx);
  const [{ statuses }, { tags }, plan] = await Promise.all([
    readTicketStatuses(ctx.storage),
    readTicketTags(ctx.storage),
    readStoredPlan(ctx.storage),
  ]);
  return {
    rows: [],
    attributes: [...buildTicketAttributes(statuses, tags), ...timelineTicketAttributes(plan?.deadlines ?? [])],
  };
}
