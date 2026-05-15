import { IconButton, Stack } from "@chakra-ui/react";
import { ShellIcon, type ShellWidgetRenderInput } from "../../../react";
import { railEntries } from "../mock-data/data";

export const RandomShellRail = (props: { input: ShellWidgetRenderInput }) => {
  const { input } = props;
  const activeModeId = input.shell.modes.getActiveModeId();

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
            onClick={() => input.shell.modes.setActiveMode(entry.id)}
          >
            <ShellIcon name={entry.icon} size={18} />
          </IconButton>
        );
      })}
    </Stack>
  );
};
