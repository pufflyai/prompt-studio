import { Link, Stack, Text } from "@chakra-ui/react";
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
          <Link
            key={action.id}
            role="link"
            tabIndex={0}
            color="fg.info"
            textStyle="label/S/regular"
            gap="xs"
            onClick={action.run}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              action.run();
            }}
          >
            <WorkbenchIcon name={action.icon} size={14} />
            {action.label}
          </Link>
        ))}
      </Stack>
    </Stack>
  );
};
