// Read the plan and reload it whenever Planner tickets or the stored plan change.
import { createWebviewClient, type GuestHost, viewDataEvents } from "@pstdio/sdk/extensions";
import { useState } from "react";
import type { autoBuildCommand } from "../../commands/auto-build";
import type { pauseAutoBuildCommand, resumeAutoBuildCommand } from "../../commands/auto-build-lifecycle";
import type { configureAutoBuildCommand, readAutoBuildCommand } from "../../commands/auto-build-mode";
import type { stopAutoBuildCommand } from "../../commands/auto-build-stop";
import type { openReviewRequestCommand, reviewCommand } from "../../commands/review-requests";
import type { setTicketAttributeCommand } from "../../commands/set-ticket-attribute";
import type { commands } from "../commands/index";
import { planChanged } from "../contracts";
import { plannerTicketsChanged } from "../planner";
import { useLiveValue } from "./use-live-value";

// The timeline answers Planner review requests through the same commands as the CLI.
type PlanCommands = typeof commands & {
  "set-ticket-attribute": typeof setTicketAttributeCommand;
  "auto-build": typeof autoBuildCommand;
  "auto-build.configure": typeof configureAutoBuildCommand;
  "auto-build.pause": typeof pauseAutoBuildCommand;
  "auto-build.resume": typeof resumeAutoBuildCommand;
  "auto-build.stop": typeof stopAutoBuildCommand;
  "auto-build.read": typeof readAutoBuildCommand;
  review: typeof reviewCommand;
  "review-requests.open": typeof openReviewRequestCommand;
};

export type PlanClient = ReturnType<typeof createWebviewClient<PlanCommands>>;

const readPlan = (client: PlanClient) => client.commands["timeline.plan.read"]();

// Planner reports tag changes as ticket changes, so track names stay current too.
const planEvents = [plannerTicketsChanged, planChanged, viewDataEvents.boardViewsChanged];

export function usePlan(host: GuestHost) {
  const [client] = useState(() => createWebviewClient<PlanCommands>(host));
  const { value: plan } = useLiveValue(client, readPlan, planEvents);
  return { client, plan };
}
