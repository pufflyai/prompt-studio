import { IconButton, Stack } from "@chakra-ui/react";
import type { ShellCore } from "../core";
import { ShellIcon, type ShellWidgetRenderInput } from "../react";
import { railEntries, railWidgetId } from "./random-shell-example-data";

const RandomShellRail = (props: { input: ShellWidgetRenderInput }) => {
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

export const registerRandomShellRail = (shell: ShellCore) => {
  shell.layout.registerWidget({
    id: railWidgetId,
    title: "Mode rail",
    area: "activityBar",
    singleton: true,
    renderer: "react",
    rendererId: railWidgetId,
  });
  shell.renderers.registerRenderer({
    id: railWidgetId,
    render: (input) => <RandomShellRail input={input} />,
  });
  shell.layout.openWidget(railWidgetId, { pinned: true, closable: false });
};
