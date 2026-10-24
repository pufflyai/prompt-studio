import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { cleanupAttentionTag } from "./cleanup-attention-tag";
import { cleanupLegacyTicketFields } from "./cleanup-legacy-ticket-fields";
import { cleanupLegacyWorkspaceStatus } from "./cleanup-legacy-workspace-status";
import { importLegacyTemplates } from "./migrate-templates";
import { migrateTicketTags } from "./migrate-ticket-tags";

// One version covers every Planner storage upgrade, so each step runs once per project
// and reads never repeat cleanup writes. Version 4 stores ticket tags by tag ID (PS-841).
export const migratePlannerStorage = (ctx: Pick<ExtensionContextBase, "files" | "storage">) =>
  ctx.storage.migrate(4, async (previous) => {
    if (previous < 1) await importLegacyTemplates(ctx);
    await cleanupLegacyWorkspaceStatus(ctx.storage);
    await cleanupLegacyTicketFields(ctx.storage);
    await cleanupAttentionTag(ctx.storage);
    await migrateTicketTags(ctx.storage);
  });

type StorageContext = Pick<ExtensionContextBase, "files" | "storage">;

// Commands and hooks can run before any Planner view opens, for example from the CLI or an
// event. They upgrade storage first, so they never read or write tickets in an older shape.
export const onCurrentStorage = <T extends { run(ctx: StorageContext, ...args: never[]): unknown }>(entry: T) =>
  ({
    ...entry,
    run: async (ctx: StorageContext, ...args: never[]) => {
      await migratePlannerStorage(ctx);
      return entry.run(ctx, ...args);
    },
  }) as T;
