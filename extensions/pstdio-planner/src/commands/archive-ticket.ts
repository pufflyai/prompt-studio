import { patchCollectionRecords } from "@pstdio/sdk/data";
import {
  defineCommand,
  type ExtensionContextBase,
  l10n,
  params,
  type StorageQueryRecord,
} from "@pstdio/sdk/extensions";
import { findStoredTicket } from "../data/resolve";
import { ticketWithCurrentTitle, withTicketIdentity } from "../data/ticket-identity";
import { changeTicketRecord } from "../data/ticket-records";
import { ticketSelectionPage } from "../data/ticket-selection";
import { withTicketTagIds } from "../data/ticket-tags";
import { queueTicketWrite, queueTicketWrites } from "../data/ticket-write-queue";
import { plannerTicketsChanged } from "../events";
import { ticketMenuSlots } from "../resource-kinds";
import { ticketRefFromCommandContext } from "./ticket-command-ref";
import { cleanupTicketWorkspacesCommand, deleteUnusedLinkedWorkspaces } from "./ticket-workspace-cleanup";

const ARCHIVE_ALL_COLUMN_ACTION = "archive_all";

export const archiveTicketCommand = defineCommand({
  id: "archive-ticket",
  mutating: true,
  title: "Archive ticket",
  cli: { globalAliases: [["tickets", "archive"]], examples: ["pstdio pstdio.pstdio-planner archive-ticket --id PS-1"] },
  menus: [
    {
      slot: ticketMenuSlots.headerOverflow,
      label: l10n("kanbanRenderers.tickets.rowActions.archive", "Archive"),
      icon: "archive",
      placement: "last",
      when: { metadata: { archived: false } },
    },
  ],
  async run(ctx, commandParams) {
    const existing = await findStoredTicket(ctx, ticketRefFromCommandContext(ctx, commandParams));
    if (!existing) return null;

    const saved = await queueTicketWrite(existing.id, () =>
      changeTicketRecord(ctx.storage, existing.id, (current) => ({
        ...current,
        archived: true,
        updatedAt: new Date().toISOString(),
      })),
    );
    if (!saved) return null;
    const next = await withTicketIdentity(ctx, ticketWithCurrentTitle(saved));

    // Await cascade so single-ticket UX reflects completion, but never reject:
    // the ticket is durably archived, so a cleanup failure should not be reported
    // as a failed archive. The failure surfaces via a persistent notification instead.
    await deleteUnusedLinkedWorkspaces(ctx, [next]);
    await ctx.events.emit(plannerTicketsChanged, { ticketId: next.id });

    return withTicketTagIds(next);
  },
});

const archiveSelectedTickets = (
  ctx: Pick<ExtensionContextBase, "storage">,
  selected: StorageQueryRecord[],
  columnId: string,
) =>
  queueTicketWrites(
    selected.map(({ fields }) => String(fields.id)),
    async () => {
      let current = selected;
      for (;;) {
        if (!current.length) return [];
        const outcome = await patchCollectionRecords(ctx.storage, current, {
          archived: true,
          updatedAt: new Date().toISOString(),
        });
        if (outcome) {
          if (outcome.state === "refused" || outcome.state === "needs-attention")
            throw new Error(outcome.reason ?? "Ticket archival was refused");
          return current.map(({ fields }) => String(fields.id));
        }
        current = (
          await ticketSelectionPage(ctx.storage, {
            index: "ticket-status",
            limit: 100,
            where: {
              all: [
                { field: "id", op: "in", value: selected.map(({ fields }) => fields.id) },
                { field: "archived", op: "eq", value: false },
                { field: "statusId", op: "eq", value: columnId },
              ],
            },
          })
        ).records;
      }
    },
  );

export const archiveTicketColumnAction = async (
  ctx: Pick<
    ExtensionContextBase,
    "events" | "notify" | "storage" | "workspaces" | "settings" | "resources" | "automation"
  >,
  input: { columnId: string; actionId: string },
) => {
  if (input.actionId !== ARCHIVE_ALL_COLUMN_ACTION) return { archivedCount: 0 };
  let archivedCount = 0;
  let after: string | undefined;
  for (;;) {
    const page = await ticketSelectionPage(ctx.storage, {
      index: "ticket-status",
      after,
      where: {
        all: [
          { field: "archived", op: "eq", value: false },
          { field: "statusId", op: "eq", value: input.columnId },
        ],
      },
    });
    if (!page.records.length) break;
    const archived: string[] = [];
    archived.push(...(await archiveSelectedTickets(ctx, page.records, input.columnId)));
    archivedCount += archived.length;
    // Durable jobs retain bounded IDs, not detached closures holding every archived body.
    if (archived.length) {
      try {
        await ctx.automation.enqueue({
          command: cleanupTicketWorkspacesCommand.ref,
          input: { params: { ticketIds: archived } },
          key: `archive-cleanup:${ctx.storage.ids.create()}`,
        });
      } catch (error) {
        await ctx.notify
          .action({
            title: "Workspace cleanup failed",
            body: `Could not queue linked workspace cleanup: ${String(error)}`,
            kind: "failed",
            priority: "normal",
          })
          .catch(() => {});
      }
    }
    after = String(page.records.at(-1)!.fields.id);
    if (page.records.length < 100) break;
  }

  // Tickets are durable and cleanup jobs are queued before the board refreshes.
  await ctx.events.emit(plannerTicketsChanged, {});

  return { archivedCount };
};

export const archiveTicketColumnActionCommand = defineCommand({
  id: "ticket-column-action",
  title: "Run ticket column action",
  params: {
    columnId: params.text({ required: true }),
    actionId: params.text({ required: true }),
  },
  run: archiveTicketColumnAction,
});
