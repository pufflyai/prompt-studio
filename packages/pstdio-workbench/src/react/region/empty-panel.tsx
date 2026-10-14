import { Button, Stack } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import { type WorkbenchCore, type WorkbenchPanelRegion, type WorkbenchRegion, workbenchPanelRegions } from "../../core";
import { closedDeclaredTools } from "../../core/controllers/composition/declared-tools";
import { runUserAction } from "../../core/shared/run-user-action";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { useWorkbenchCompositionPanels } from "../shared/use-workbench-composition-panels";

export const EmptyPanel = (props: { workbench: WorkbenchCore; region: WorkbenchRegion; occupied: boolean }) => {
  const { workbench, region, occupied } = props;
  const policy = usePanelPolicy(workbench, region);
  const panels = useWorkbenchCompositionPanels(workbench);
  if (!workbenchPanelRegions.some((panelRegion) => panelRegion === region)) return null;
  if (occupied || !policy.open) return null;
  const tools = closedDeclaredTools(panels[region as WorkbenchPanelRegion], region as WorkbenchPanelRegion);
  if (!policy.acceptsTabs && tools.length === 0) return null;
  const actions = (
    <Stack gap="sm" align="center" justify="center" h={policy.acceptsTabs ? undefined : "full"}>
      {tools.map((tool) => (
        <Button
          key={tool.panelId}
          size="xs"
          variant="outline"
          onClick={() =>
            void runUserAction(workbench, `Open ${tool.contribution.title}`, () =>
              tool.open?.(workbench.getPrimaryResource()),
            )
          }
        >
          Open {tool.contribution.title}
        </Button>
      ))}
    </Stack>
  );
  if (!policy.acceptsTabs) return actions;
  return (
    <Stack h="full" justify="center">
      <EmptyState title="Drop a tab here" size="sm" p="sm">
        {actions}
      </EmptyState>
    </Stack>
  );
};
