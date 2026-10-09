// Read the plan and reload it whenever Planner tickets or the stored plan change.
import { createWebviewClient, type GuestHost } from "@pstdio/sdk/extensions";
import { useState } from "react";
import type { commands } from "../commands/index";
import { planChanged } from "../contracts";
import { plannerTicketsChanged } from "../planner";
import { useLiveValue } from "./use-live-value";

export type PlanClient = ReturnType<typeof createWebviewClient<typeof commands>>;

const readPlan = (client: PlanClient) => client.commands["timeline.plan.read"]();

// Planner reports tag changes as ticket changes, so track names stay current too.
const planEvents = [plannerTicketsChanged, planChanged];

export function usePlan(host: GuestHost) {
  const [client] = useState(() => createWebviewClient<typeof commands>(host));
  const { value: plan, error } = useLiveValue(client, readPlan, planEvents);
  return { client, plan, error };
}
