// Create immutable human requests and atomically save one answer per request.
import { defineCommand, params } from "@pstdio/sdk/extensions";
import { findTicket } from "../../data/resolve";
import { readTicketStatuses } from "../../data/status-operations";
import { planChanged } from "../contracts";
import type { ActionResponse, HumanAction } from "../model/action-types";
import { parseAction, resolveAction } from "../model/actions";
import { isCompletedTicket } from "../model/workflow";
import { keepOwnedAction, ownedAction } from "./action-owner";
import { readActionStore, requests, saveOutcome } from "./action-store";

export const readActionsCommand = defineCommand({
  id: "timeline.action.read",
  title: "Read human actions",
  cli: { description: "Read requests and saved answers for one ticket." },
  params: { ticket: params.text({ required: true }) },
  async run(ctx, { ticket }) {
    const current = await findTicket(ctx.storage, ticket);
    if (!current) {
      throw new Error("Unknown ticket.");
    }
    const all = await readActionStore(ctx);
    return {
      ...(all.get(current.id) ?? { actions: [], errors: [] }),
      instructions: current.content ?? "",
      reason: current.blockedReason,
    };
  },
});

export const requestActionCommand = defineCommand({
  id: "timeline.action.request",
  title: "Request human action",
  cli: { description: "Attach an immutable task or decision request to a ticket." },
  mutating: true,
  params: {
    ticket: params.text({ required: true }),
    action: params.json<Pick<HumanAction, "title" | "instructions" | "request">, { required: true }>({
      required: true,
    }),
  },
  async run(ctx, { ticket, action }) {
    const current = await findTicket(ctx.storage, ticket);
    if (!current || isCompletedTicket(current, (await readTicketStatuses(ctx.storage)).statuses)) {
      throw new Error("The ticket is removed or complete.");
    }
    const value = parseAction(
      JSON.stringify({
        title: action.title,
        instructions: action.instructions,
        request: action.request,
        version: 1,
        id: crypto.randomUUID(),
        revision: 1,
      }),
    );
    const stored = { ...value, ticketId: current.id };
    await requests(ctx).createIfAbsent(value.id, stored);
    await keepOwnedAction(ctx, stored);
    await ctx.events.emit(planChanged, { reason: "action-request" });
    return value;
  },
});

export const resolveActionCommand = defineCommand({
  id: "timeline.action.resolve",
  title: "Resolve human action",
  cli: { description: "Save one validated answer or completion confirmation." },
  mutating: true,
  params: {
    ticket: params.text({ required: true }),
    actionId: params.text({ required: true }),
    expectedRevision: params.number({ required: true }),
    response: params.json<ActionResponse, { required: true }>({ required: true }),
  },
  async run(ctx, { ticket, actionId, expectedRevision, response }) {
    const { stored, action } = await ownedAction(ctx, ticket, actionId);
    const resolved = resolveAction(action, expectedRevision, response);
    if (!resolved.resolution) {
      throw new Error("The response is missing.");
    }
    await saveOutcome(ctx, stored, { kind: "resolved", resolution: resolved.resolution });
    await keepOwnedAction(ctx, stored);
    await ctx.events.emit(planChanged, { reason: "action-resolved" });
    return resolved;
  },
});
