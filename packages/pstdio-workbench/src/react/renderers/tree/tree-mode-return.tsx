import { Box } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { useSyncExternalStore } from "react";
import type { WorkbenchCore } from "../../../core";
import { resolveNavigationLevels } from "../../../core/controllers/page-location/navigation-level";
import { WorkbenchIcon } from "../../shared/icon";
import { useWorkbenchStore } from "../../shared/use-workbench-store";

export const TreeModeReturn = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const pages = useWorkbenchStore(workbench.pages.store, (state) => state);
  const mode = useWorkbenchStore(workbench.modes.store, (state) =>
    state.activeModeId ? state.modes[state.activeModeId] : undefined,
  );
  const hasLevel = useSyncExternalStore(
    (listener) => {
      const subscription = workbench.navigationTrees.onDidChange(listener);
      return () => subscription.dispose();
    },
    () =>
      resolveNavigationLevels({
        location: pages.location,
        pages: Object.values(pages.pages),
        navigationTrees: workbench.navigationTrees,
      }).length > 0,
  );
  if (!hasLevel || !mode) return null;

  return (
    <Box pb="1px">
      <ListRow
        id="workbench.navigation.root"
        role="button"
        label={mode.label ?? mode.id}
        icon={<WorkbenchIcon name="ArrowLeft" size={14} />}
        variant="compact"
        onActivate={() => workbench.pageLocations.navigateToRootLevel()}
      />
    </Box>
  );
};
