import { Box } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { useSyncExternalStore } from "react";
import type { WorkbenchCore } from "../../../core";
import {
  MODE_RETURN_COMMAND_ID,
  modeReturnLabel,
} from "../../../core/controllers/page-location/mode-navigation-shortcuts";
import { resolveNavigationLevels } from "../../../core/controllers/page-location/navigation-level";
import { runUserAction } from "../../../core/shared/run-user-action";
import { WorkbenchShortcutHint } from "../../keybindings/shortcut-hint";
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
  const label = modeReturnLabel(workbench);

  return (
    <Box pb="1px">
      <ListRow
        id="workbench.navigation.root"
        role="button"
        label={label}
        icon={<WorkbenchIcon name="ArrowLeft" size={14} />}
        variant="compact"
        endContent={
          <WorkbenchShortcutHint
            workbench={workbench}
            action={{ kind: "command", commandId: MODE_RETURN_COMMAND_ID }}
            modeOnly
          />
        }
        onActivate={() => {
          void runUserAction(workbench, label, () => workbench.commands.executeCommand(MODE_RETURN_COMMAND_ID));
        }}
      />
    </Box>
  );
};
