import { Button, HStack, Text } from "@chakra-ui/react";
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
    <HStack gap="xs" minW="0" justifyContent="space-between" w="full">
      <HStack gap="xs" minW="0">
        <ShellIcon name={setup.icon} size={16} />
        <Text textStyle="label/S/medium" truncate>
          {setup.title}
        </Text>
      </HStack>
      <HStack gap="2xs">
        {(Object.keys(leftPanelSetups) as LeftPanelMode[]).map((mode) => (
          <Button
            key={mode}
            size="2xs"
            variant={mode === activeMode ? "subtle" : "ghost"}
            onClick={() => shell.modes.setActiveMode(mode)}
          >
            {leftPanelSetups[mode].title}
          </Button>
        ))}
      </HStack>
    </HStack>
  );
};
