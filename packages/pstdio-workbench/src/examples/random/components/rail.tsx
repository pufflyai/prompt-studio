import { IconButton, Stack } from "@chakra-ui/react";
import { WorkbenchIcon, type WorkbenchPanelRenderInput } from "../../../react";
import { railEntries } from "../mock-data/data";

export const RandomWorkbenchRail = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const activeModeId = input.workbench.modes.getActiveModeId();

  return (
    <Stack h="full" alignItems="center" py="sm" gap="sm">
      {railEntries.map((entry) => {
        const selected = entry.id === activeModeId;
        return (
          <IconButton
            key={entry.id}
            aria-label={entry.label}
            size="sm"
            variant={selected ? "subtle" : "ghost"}
            onClick={() => input.workbench.modes.setActiveMode(entry.id)}
          >
            <WorkbenchIcon name={entry.icon} size={18} />
          </IconButton>
        );
      })}
    </Stack>
  );
};
