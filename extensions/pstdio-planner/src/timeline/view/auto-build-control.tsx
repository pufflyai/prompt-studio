import { type GuestHost, workbenchPanels } from "@pstdio/sdk/extensions";
import { ticketRequestsTarget } from "../../data/ticket-page-target";
import { AutoBuildButton } from "./auto-build-button";
import type { timelineQueryData } from "./timeline-query";
import { useAutoBuild } from "./use-auto-build";
import type { PlanClient } from "./use-plan";

interface AutoBuildControlProps {
  host: GuestHost;
  client: PlanClient;
  t: (key: string, fallback?: string) => string;
  data: ReturnType<typeof timelineQueryData>;
}

// Capacity and supervisor updates belong to the control, so they do not rerender the graph.
export function AutoBuildControl(props: AutoBuildControlProps) {
  const { host, client, t, data } = props;
  const autoBuild = useAutoBuild(client);
  return (
    <AutoBuildButton
      enabled={autoBuild.mode?.enabled ?? false}
      paused={autoBuild.mode?.state === "paused"}
      reviewRequests={autoBuild.mode?.reviewRequests}
      requestErrors={autoBuild.mode?.requestErrors}
      onOpenRequest={(request) =>
        void host.call("navigation.open", {
          target: ticketRequestsTarget({ type: "ticket", id: request.ticketId, extensionId: "pstdio.pstdio-planner" }),
        })
      }
      onPause={() => autoBuild.transition("pause")}
      onResume={() => autoBuild.transition("resume")}
      completed={autoBuild.mode?.completed}
      matchingTicketCount={autoBuild.mode?.matchingTicketCount}
      readyTicketCount={autoBuild.mode?.readyTicketCount}
      waitingTickets={autoBuild.mode?.waitingTickets}
      starting={autoBuild.mode?.running}
      supervisor={autoBuild.mode?.supervisor}
      sessions={autoBuild.mode?.sessions ?? []}
      running={autoBuild.mode?.capacity.running ?? 0}
      capacity={autoBuild.mode?.capacity.limit ?? 0}
      stuck={autoBuild.mode?.stuck}
      error={autoBuild.mode?.configurationError ?? autoBuild.mode?.error}
      onOpenSession={(session) =>
        void host.call("navigation.open", {
          target: {
            kind: "panel",
            panel: workbenchPanels.projectSession,
            open: "preview",
            resource: { type: "session", id: session.id, extensionId: "pstdio", label: session.title },
          },
        })
      }
      actionError={autoBuild.error}
      disabled={!autoBuild.mode || autoBuild.saving}
      configuration={
        autoBuild.mode
          ? {
              prompt: autoBuild.mode.prompt,
              supervisorModel: autoBuild.mode.supervisorModel,
              host,
              requireMergedDependencies: autoBuild.mode.requireMergedDependencies,
              eligible: autoBuild.mode.eligible,
              data,
              saving: autoBuild.saving,
              error: autoBuild.error,
              onEnable: (prompt, requireMergedDependencies, eligible, supervisorModel) =>
                autoBuild.configure(true, prompt, requireMergedDependencies, eligible, supervisorModel),
            }
          : undefined
      }
      t={t}
    />
  );
}
