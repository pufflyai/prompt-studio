import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { cleanupAttentionTag } from "./cleanup-attention-tag";
import { cleanupLegacyTicketFields } from "./cleanup-legacy-ticket-fields";
import { cleanupLegacyWorkspaceStatus } from "./cleanup-legacy-workspace-status";
import { importLegacyTemplates } from "./migrate-templates";
import { migrateTicketOrder } from "./migrate-ticket-order";
import { TICKET_KEY_PREFIX, TICKETS_COLLECTION } from "./ticket-record-address";

// One version covers every Planner storage upgrade, so each step runs once per project
// and reads never repeat cleanup writes. Version 5 moves tickets to records before any other
// step reads them; ticket storage runs this first, so it accepts a storage-only context.
const migrating = new WeakSet<object>();
const ready = new WeakMap<object, Promise<void>>();

const runMigrations = async (
  ctx: Pick<ExtensionContextBase, "storage"> & Partial<Pick<ExtensionContextBase, "files">>,
) => {
  // The steps get their own storage object, so only their reads skip the wait; other callers on
  // ctx.storage wait for the move instead of reading before it.
  const storage = { ...ctx.storage };
  migrating.add(storage);
  try {
    await ctx.storage.migrate(5, async (previous, migration) => {
      if (previous < 5) await migration.moveCollection(TICKETS_COLLECTION, { keyPrefix: TICKET_KEY_PREFIX });
      if (previous < 1) await importLegacyTemplates({ ...ctx, storage });
      if (previous < 4) {
        await cleanupLegacyWorkspaceStatus(storage);
        await cleanupLegacyTicketFields(storage);
        await cleanupAttentionTag(storage);
        await migrateTicketOrder(storage, migration);
      }
    });
  } finally {
    migrating.delete(storage);
  }
};

export const migratePlannerStorage = (
  ctx: Pick<ExtensionContextBase, "storage"> & Partial<Pick<ExtensionContextBase, "files">>,
) => {
  // A running migration's own steps read tickets; they must not wait for themselves.
  if (migrating.has(ctx.storage)) return Promise.resolve();
  const existing = ready.get(ctx.storage);
  if (existing) return existing;
  const run = runMigrations(ctx).catch((error: unknown) => {
    ready.delete(ctx.storage);
    throw error;
  });
  ready.set(ctx.storage, run);
  return run;
};
