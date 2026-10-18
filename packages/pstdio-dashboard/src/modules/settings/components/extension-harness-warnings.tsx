import { Stack, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { TriangleAlert } from "lucide-react";
import type { AgentInfo } from "pstdio-api-contracts";

export const ExtensionHarnessWarnings = (props: { harnesses: AgentInfo[] }) => {
  const { harnesses } = props;
  if (!harnesses.length) return null;
  return (
    <Stack gap="2xs">
      {harnesses.map((harness) => (
        <AlertMessage
          key={harness.id}
          status="warning"
          role="alert"
          icon={<TriangleAlert />}
          title={`${harness.name} is unavailable`}
        >
          {harness.availability.reason ? (
            <Text whiteSpace="pre-wrap" wordBreak="break-word">
              {harness.availability.reason}
            </Text>
          ) : undefined}
        </AlertMessage>
      ))}
    </Stack>
  );
};
