import { IconButton, Stack } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { ShellIcon, type ShellWidgetRenderInput } from "pstdio-shell/react";
import { modeOrder } from "./constants";

export const ModeSwitcher = (props: { input: ShellWidgetRenderInput }) => {
  const { input } = props;
  const activeModeId = input.shell.modes.getActiveModeId();

  return (
    <Stack h="full" alignItems="center" py="sm" gap="xs">
      {modeOrder.map((mode) => {
        const selected = mode.id === activeModeId;
        return (
          <Tooltip key={mode.id} content={`${mode.label} — ${mode.description}`} positioning={{ placement: "right" }}>
            <IconButton
              aria-label={`Switch to ${mode.label} mode`}
              size="sm"
              variant={selected ? "subtle" : "ghost"}
              onClick={() => {
                input.shell.modes.setActiveMode(mode.id);
                input.refresh();
              }}
            >
              <ShellIcon name={mode.icon} size={20} />
            </IconButton>
          </Tooltip>
        );
      })}
    </Stack>
  );
};
