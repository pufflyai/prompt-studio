import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { cleanupAttentionTag } from "./cleanup-attention-tag";
import { cleanupLegacyTicketFields } from "./cleanup-legacy-ticket-fields";
import { cleanupLegacyWorkspaceStatus } from "./cleanup-legacy-workspace-status";
import { importLegacyTemplates } from "./migrate-templates";
import { migrateTicketOrder } from "./migrate-ticket-order";

// One version covers every Planner storage upgrade, so each step runs once per project
// and reads never repeat cleanup writes.
export const migratePlannerStorage = async (ctx: Pick<ExtensionContextBase, "files" | "storage">) => {
  await ctx.storage.migrate(4, async (previous, migration) => {
    if (previous < 1) await importLegacyTemplates(ctx);
    await cleanupLegacyWorkspaceStatus(ctx.storage);
    await cleanupLegacyTicketFields(ctx.storage);
    await cleanupAttentionTag(ctx.storage);
    if (previous < 4) await migrateTicketOrder(ctx.storage, migration);
  });
};
