import { Link, Spinner, Stack, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { HomeIcon as WorkbenchIcon } from "./home-icon";

export interface StartAction {
  id: string;
  label: string;
  icon: string;
  run: () => void;
}

interface StartActionListProps {
  actions: StartAction[];
  pending?: string;
  error?: { id: string; message: string };
}

export const StartActionList = (props: StartActionListProps) => {
  const { actions, pending, error } = props;

  return (
    <Stack gap="sm" minW="0">
      <Text textStyle="label/L/regular">Start</Text>
      <Stack gap="sm" minW="0" align="flex-start">
        {actions.map((action) => (
          <Stack key={action.id} gap="xs">
            <Link
              aria-disabled={pending === action.id}
              role="link"
              tabIndex={0}
              color="fg.info"
              textStyle="label/S/regular"
              gap="xs"
              onClick={() => {
                if (pending !== action.id) action.run();
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                if (pending !== action.id) action.run();
              }}
            >
              {pending === action.id ? <Spinner size="xs" /> : <WorkbenchIcon name={action.icon} size={14} />}
              {action.label}
            </Link>
            {error?.id === action.id && <AlertMessage status="error" title={error.message} />}
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
};
