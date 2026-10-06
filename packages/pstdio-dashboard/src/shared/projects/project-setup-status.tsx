import { Button, Stack, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";

interface ProjectSetupStatusProps {
  error: string;
  retrying?: boolean;
  onRetry: () => void;
}

// Setup can fail on the folder or on the default extension download, which needs Git and a network.
// A person who never reads the docs needs the fix where they see the problem.
export const ProjectSetupStatus = (props: ProjectSetupStatusProps) => {
  const { error, retrying, onRetry } = props;

  return (
    <AlertMessage
      status="error"
      variant="subtle"
      role="alert"
      title="Project setup did not finish"
      endElement={
        <Button variant="outline" size="sm" loading={retrying} onClick={onRetry}>
          Retry setup
        </Button>
      }
    >
      <Stack gap="xs" minW="0">
        <Text>
          Agents and extension commands cannot run in this folder until setup finishes. Fix the problem below, then
          retry. If it mentions Git or GitHub, check that Git is installed and that this computer is online.
        </Text>
        <Text textStyle="mono/XS" whiteSpace="pre-wrap" wordBreak="break-word">
          {error}
        </Text>
      </Stack>
    </AlertMessage>
  );
};
