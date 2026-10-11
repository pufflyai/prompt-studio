// Read the plan and reload it whenever Planner tickets or the stored plan change.
import { createWebviewClient, type GuestHost } from "@pstdio/sdk/extensions";
import { useState } from "react";
import type { openReviewRequestCommand, reviewCommand } from "../../commands/review-requests";
import type { commands } from "../commands/index";
import { planChanged } from "../contracts";
import { plannerTicketsChanged } from "../planner";
import { useLiveValue } from "./use-live-value";

// The timeline answers Planner review requests through the same commands as the CLI.
type PlanCommands = typeof commands & {
  review: typeof reviewCommand;
  "review-requests.open": typeof openReviewRequestCommand;
};

export type PlanClient = ReturnType<typeof createWebviewClient<PlanCommands>>;

const readPlan = (client: PlanClient) => client.commands["timeline.plan.read"]();

// Planner reports tag changes as ticket changes, so track names stay current too.
const planEvents = [plannerTicketsChanged, planChanged];

export function usePlan(host: GuestHost) {
  const [client] = useState(() => createWebviewClient<PlanCommands>(host));
  const { value: plan, error } = useLiveValue(client, readPlan, planEvents);
  return { client, plan, error };
}
