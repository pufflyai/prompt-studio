import { Button, HStack, Stack } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { getPageContentRecovery } from "../../core/controllers/page-runtime/page-content-recovery";
import { PageViewOwnerContext } from "../renderers/use-page-params";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchWidgetHost } from "./widget-host";

export const EmptyPage = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const pageState = useWorkbenchStore(workbench.pages.store, (state) => state);
  const layout = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const recovery = getPageContentRecovery(workbench, pageState, layout);
  if (!recovery) return null;
  const actions = (
    <HStack gap="sm" justify="center" flexWrap="wrap">
      {recovery.open ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => workbench.commands.executeCommand("workbench.reopenPageContent")}
        >
          {recovery.label}
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" onClick={() => workbench.commands.executeCommand("workbench.resetLayout")}>
        Reset layout
      </Button>
    </HStack>
  );
  if (!recovery.viewId) return <EmptyState title="No tabs open">{actions}</EmptyState>;
  return (
    <Stack flex="1" minH="0" gap="md">
      <PageViewOwnerContext value={pageState.activePageId}>
        <WorkbenchWidgetHost
          workbench={workbench}
          region="main"
          placement={{
            widgetId: "workbench.empty-page",
            contributionId: "workbench.empty-page",
            viewId: recovery.viewId,
            closable: false,
            resource: recovery.resource,
          }}
        />
      </PageViewOwnerContext>
      {actions}
    </Stack>
  );
};
