import { Button, Stack, Text } from "@chakra-ui/react";
import { WorkbenchIcon } from "@pstdio/workbench/react";

export interface StartAction {
  id: string;
  label: string;
  icon: string;
  run: () => void;
}

interface StartActionListProps {
  actions: StartAction[];
}

export const StartActionList = (props: StartActionListProps) => {
  const { actions } = props;

  return (
    <Stack gap="sm" minW="0">
      <Text textStyle="label/L/regular">Start</Text>
      <Stack gap="sm" minW="0" align="flex-start">
        {actions.map((action) => (
          <Button key={action.id} variant="ghost" size="sm" px="none" color="fg.info" gap="xs" onClick={action.run}>
            <WorkbenchIcon name={action.icon} size={14} />
            <Text textStyle="label/S/regular">{action.label}</Text>
          </Button>
        ))}
      </Stack>
    </Stack>
  );
};
