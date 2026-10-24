import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { cleanupAttentionTag } from "./cleanup-attention-tag";
import { cleanupLegacyTicketFields } from "./cleanup-legacy-ticket-fields";
import { cleanupLegacyWorkspaceStatus } from "./cleanup-legacy-workspace-status";
import { importLegacyTemplates } from "./migrate-templates";

// One version covers every Planner storage upgrade, so each step runs once per project
// and reads never repeat cleanup writes.
export const migratePlannerStorage = (ctx: Pick<ExtensionContextBase, "files" | "storage">) =>
  ctx.storage.migrate(3, async (previous) => {
    if (previous < 1) await importLegacyTemplates(ctx);
    await cleanupLegacyWorkspaceStatus(ctx.storage);
    await cleanupLegacyTicketFields(ctx.storage);
    await cleanupAttentionTag(ctx.storage);
  });
