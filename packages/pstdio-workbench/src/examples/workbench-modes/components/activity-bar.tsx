import { IconButton, Stack } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { WorkbenchIcon, type WorkbenchWidgetRenderInput } from "../../../react";
import { type WorkbenchModeId, workbenchModeOrder, workbenchModes } from "../mock-data/data";

export const WorkbenchModesActivityBar = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const activeModeId = input.workbench.modes.getActiveModeId() as WorkbenchModeId | undefined;

  return (
    <Stack h="full" alignItems="center" py="sm" gap="xs">
      {workbenchModeOrder.map((modeId) => {
        const mode = workbenchModes[modeId];
        const selected = modeId === activeModeId;
        return (
          <Tooltip key={mode.id} content={`${mode.label} — ${mode.description}`} positioning={{ placement: "right" }}>
            <IconButton
              aria-label={`Switch to ${mode.label} mode`}
              size="sm"
              variant={selected ? "subtle" : "ghost"}
              onClick={() => {
                input.workbench.modes.setActiveMode(mode.id);
                input.refresh();
              }}
            >
              <WorkbenchIcon name={mode.icon} size={20} />
            </IconButton>
          </Tooltip>
        );
      })}
    </Stack>
  );
};
