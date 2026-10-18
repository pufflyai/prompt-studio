import { type GuestHost, workbenchPanels } from "@pstdio/sdk/extensions";
import { installPrismGlobal } from "@pstdio/ui";
import { lazy, Suspense, useState } from "react";
import { AutoBuildButton } from "./auto-build-button";
import type { timelineQueryData } from "./timeline-query";
import { useAutoBuild } from "./use-auto-build";
import type { PlanClient } from "./use-plan";

const AutoBuildDialog = lazy(async () => {
  await installPrismGlobal();
  return import("./auto-build-dialog").then((module) => ({ default: module.AutoBuildDialog }));
});

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
  const [open, setOpen] = useState(false);
  return (
    <>
      <AutoBuildButton
        enabled={autoBuild.mode?.enabled ?? false}
        supervisor={autoBuild.mode?.supervisor}
        sessions={autoBuild.mode?.sessions ?? []}
        running={autoBuild.mode?.capacity.running ?? 0}
        capacity={autoBuild.mode?.capacity.limit ?? 0}
        stuck={autoBuild.mode?.stuck}
        error={autoBuild.mode?.error}
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
        disabled={!autoBuild.mode || autoBuild.saving}
        onConfigure={() =>
          void autoBuild.refresh().then((success) => {
            if (success) setOpen(true);
          })
        }
        onTurnOff={() => autoBuild.configure(false)}
        t={t}
      />
      {open ? (
        <Suspense fallback={null}>
          <AutoBuildDialog
            prompt={autoBuild.mode!.prompt}
            ignore={autoBuild.mode!.ignore}
            blockOnReview={autoBuild.mode!.blockOnReview}
            data={data}
            saving={autoBuild.saving}
            error={autoBuild.error}
            onEnable={(prompt, ignore, blockOnReview) => autoBuild.configure(true, prompt, ignore, blockOnReview)}
            onClose={() => setOpen(false)}
            t={t}
          />
        </Suspense>
      ) : null}
    </>
  );
}
