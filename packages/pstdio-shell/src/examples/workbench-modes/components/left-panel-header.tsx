import { HStack, Text } from "@chakra-ui/react";
import { useLayoutEffect, useState } from "react";
import type { ShellCore } from "../../../core";
import { ShellIcon } from "../../../react";
import { type LeftPanelMode, leftPanelSetups } from "../mock-data/data";

export const LeftPanelHeader = (props: { shell: ShellCore }) => {
  const { shell } = props;
  const [activeMode, setActiveMode] = useState<LeftPanelMode>(
    (shell.modes.getActiveModeId() as LeftPanelMode | undefined) ?? "project",
  );

  useLayoutEffect(() => {
    return shell.modes.onDidChangeActive(() => {
      const next = shell.modes.getActiveModeId() as LeftPanelMode | undefined;
      if (next) setActiveMode(next);
    }).dispose;
  }, [shell]);

  const setup = leftPanelSetups[activeMode];

  return (
    <HStack gap="xs" minW="0">
      <ShellIcon name={setup.icon} size={16} />
      <Text textStyle="label/S/medium" truncate>
        {setup.title}
      </Text>
    </HStack>
  );
};
