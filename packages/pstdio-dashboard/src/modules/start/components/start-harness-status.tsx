import { Button, Flex, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { TriangleAlert } from "lucide-react";
import type { AgentInfo } from "pstdio-api-contracts";

interface StartHarnessStatusProps {
  agents: AgentInfo[];
  isPending?: boolean;
  isFetching?: boolean;
  isError?: boolean;
  onReviewExtensions: () => void;
  onCheckAgain: () => void;
}

export const StartHarnessStatus = (props: StartHarnessStatusProps) => {
  const { agents, isPending, isFetching, isError, onReviewExtensions, onCheckAgain } = props;

  if (isPending) {
    return (
      <HStack gap="xs" color="fg.muted" role="status">
        <Spinner size="xs" />
        <Text textStyle="paragraph/S/regular">Checking agent availability…</Text>
      </HStack>
    );
  }

  if (isError) {
    return (
      <AlertMessage status="error" variant="subtle" role="alert" title="Could not check agent availability">
        <Stack gap="xs" align="flex-start">
          <Text>Try checking again. Your tools are still available.</Text>
          <Button size="sm" variant="outline" loading={isFetching} onClick={onCheckAgain}>
            Check again
          </Button>
        </Stack>
      </AlertMessage>
    );
  }

  if (agents.some((agent) => agent.availability.type === "INSTALLED")) return null;

  return (
    <AlertMessage status="warning" variant="subtle" role="alert" title="No agent available" icon={<TriangleAlert />}>
      <Stack gap="xs" minW="0">
        <Text>
          No enabled harness extension is available for this project. Review your extensions to set up an agent.
        </Text>
        {agents.map((agent) => (
          <Stack key={agent.id} gap="0" minW="0">
            <Text textStyle="label/S/medium" wordBreak="break-word">
              {agent.name}
            </Text>
            {agent.availability.reason && (
              <Text whiteSpace="pre-wrap" wordBreak="break-word">
                {agent.availability.reason}
              </Text>
            )}
          </Stack>
        ))}
        <Flex gap="xs" wrap="wrap">
          <Button size="sm" variant="outline" onClick={onReviewExtensions}>
            Review extensions
          </Button>
          <Button size="sm" variant="outline" loading={isFetching} onClick={onCheckAgain}>
            Check again
          </Button>
        </Flex>
      </Stack>
    </AlertMessage>
  );
};
