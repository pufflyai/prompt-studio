// Load the stored plan against current Planner tickets, save edits, and resolve CLI names to ids.
import type { ExtensionContextBase, ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { readTickets } from "../../commands/read-tickets";
import { readTicketStatuses } from "../../data/status-operations";
import { readWorkflowStatuses, usableWorkflowStatuses } from "../../data/workflow-statuses";
import { plannerSchemaChanged } from "../../events";
import { planChanged, type StoredPlan } from "../contracts";
import { resolvePlan } from "../model/resolve-plan";
import type { PlannerTicket } from "../planner";
import { metadataKey, type PlanMetadata, readPlanMetadata } from "./placement-store";
import { type PlacementSnapshot, planPositionEdits } from "./plan-position-edits";

// Keep existing full-plan consumers coherent with the extracted Board's
// per-ticket placement owner. Board queries never materialize this legacy view.
const readPlacements = async (storage: ExtensionStorageApi, initialRevision?: string) => {
  const rows: PlacementSnapshot[] = [];
  let after: string | undefined;
  let revision: string | undefined = initialRevision;
  for (;;) {
    const page = await storage.records.query({
      index: "timeline-placements",
      fields: ["ticketId", "deadlineId", "position"],
      limit: 100,
      orderBy: [{ field: "ticketId", direction: "asc" }],
      revision,
      ...(after ? { where: { field: "ticketId", op: "gt", value: after } } : {}),
    });
    revision = page.revision;
    rows.push(
      ...page.records.map(({ fields, recordId, revision }) => ({
        recordId,
        revision,
        ticketId: String(fields.ticketId),
        deadlineId: typeof fields.deadlineId === "string" ? fields.deadlineId : null,
        position: String(fields.position),
      })),
    );
    if (page.records.length < 100) break;
    after = rows.at(-1)!.ticketId;
  }
  return rows.sort((a, b) => {
    if (a.position !== b.position) return a.position < b.position ? -1 : 1;
    if (a.ticketId !== b.ticketId) return a.ticketId < b.ticketId ? -1 : 1;
    return 0;
  });
};
export const readPlanSnapshot = async (storage: ExtensionStorageApi) => {
  await readPlanMetadata(storage);
  const boundary = await storage.records.query({ index: "timeline-placements", fields: [], limit: 0, orderBy: [] });
  const metadata = await storage.records.read(storage.records.id(metadataKey));
  const rows = await readPlacements(storage, boundary.revision);
  const values = metadata.value as unknown as PlanMetadata;
  const deadlines = new Set(values.deadlines.map(({ id }) => id));
  const plan = {
    deadlines: values.deadlines,
    order: rows.map(({ ticketId, deadlineId }) => ({
      ticketId,
      deadlineId: deadlineId && deadlines.has(deadlineId) ? deadlineId : null,
    })),
  };
  return { plan, rows, metadata, revision: boundary.revision };
};
export type PlanSnapshot = Awaited<ReturnType<typeof readPlanSnapshot>>;
export const readStoredPlan = async (storage: ExtensionStorageApi) => (await readPlanSnapshot(storage)).plan;

export async function loadPlan(ctx: Pick<ExtensionContextBase, "storage" | "settings" | "resources">) {
  const [statuses, selections] = await Promise.all([readTicketStatuses(ctx.storage), readWorkflowStatuses(ctx)]);
  const tickets = await readTickets(ctx);
  const snapshot = await readPlanSnapshot(ctx.storage);
  const workflow = usableWorkflowStatuses(selections);
  return {
    tickets,
    workflow,
    statuses: statuses.statuses,
    plan: resolvePlan(snapshot.plan, tickets, statuses.statuses, workflow),
    snapshot,
  };
}

// Milestone actions need the existing execution order, including the implicit
// dependency-ordered tail. Select its narrow fields; never load unloaded bodies.
export const loadPlanOrder = async (ctx: Pick<ExtensionContextBase, "storage" | "settings">) => {
  const workflow = usableWorkflowStatuses(await readWorkflowStatuses(ctx));
  const snapshot = await readPlanSnapshot(ctx.storage);
  const stored = snapshot.plan;
  const tickets: Pick<PlannerTicket, "id" | "statusId" | "dependsOn">[] = [];
  let cursor: string | undefined;
  let revision: string | undefined;
  do {
    const page = await ctx.storage.records.query({
      index: "ticket-view",
      fields: ["id", "statusId", "dependsOn"],
      where: { field: "archived", op: "ne", value: true },
      orderBy: [
        { field: "position", direction: "asc" },
        { field: "id", direction: "asc" },
      ],
      limit: 100,
      cursor,
      revision,
    });
    revision = page.revision;
    tickets.push(
      ...page.records.map(({ fields }) => ({
        id: String(fields.id),
        statusId: typeof fields.statusId === "string" ? fields.statusId : null,
        dependsOn: Array.isArray(fields.dependsOn) ? (fields.dependsOn as string[]) : [],
      })),
    );
    cursor = page.cursor ?? undefined;
  } while (cursor);
  return { plan: resolvePlan(stored, tickets, [], workflow), snapshot };
};

export const writeStoredPlan = async (storage: ExtensionStorageApi, plan: StoredPlan, observed?: PlanSnapshot) => {
  const snapshot = observed ?? (await readPlanSnapshot(storage));
  const edits = await planPositionEdits(storage, plan.order, snapshot.rows);
  const publicationId = storage.ids.create();
  const deadlinesChanged = JSON.stringify(plan.deadlines) !== JSON.stringify(snapshot.plan.deadlines);
  edits.push({
    recordId: snapshot.metadata.recordId,
    expectedRevision: snapshot.metadata.revision,
    set: {
      "/publicationId": publicationId,
      ...(deadlinesChanged ? { "/deadlines": plan.deadlines.map((deadline) => ({ ...deadline })) } : {}),
    },
  });
  const outcome = await storage.records.commit({ operationId: storage.ids.create(), edits });
  if (outcome.state === "refused" || outcome.state === "needs-attention")
    throw new Error(outcome.reason ?? "Plan changed before publication");
  if ((await storage.get<PlanMetadata>(metadataKey))?.publicationId !== publicationId)
    throw new Error("Plan publication is not visible; inspect save status before continuing");
};

export async function savePlan(
  ctx: Pick<ExtensionContextBase, "storage" | "events" | "resources">,
  plan: StoredPlan,
  reason: string,
  snapshot?: PlanSnapshot,
) {
  await writeStoredPlan(ctx.storage, plan, snapshot);
  await ctx.events.emit(planChanged, { reason });
  if (reason === "deadline") await ctx.events.emit(plannerSchemaChanged, {});
}

// A deadline is named by its id, or on the CLI by its date.
export function findDeadlineId(plan: Pick<StoredPlan, "deadlines">, key: string) {
  const matches = plan.deadlines.filter(({ id, date }) => id === key || date === key);
  if (matches.length !== 1) {
    throw new Error(
      matches.length ? `Several deadlines fall on ${key}; use the deadline id.` : `Unknown deadline "${key}".`,
    );
  }

  return matches[0].id;
}

// Moving a ticket also accepts "none", which removes its deadline.
export const deadlineOrNone = (plan: Pick<StoredPlan, "deadlines">, key: string) =>
  key === "none" ? null : findDeadlineId(plan, key);
