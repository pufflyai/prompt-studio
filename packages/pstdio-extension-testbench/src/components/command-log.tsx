import { Box, Flex, Text } from "@chakra-ui/react";
import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import type { CommandCallLogEntry } from "../lib/command-call-log";

const callStatusLabel = (call: CommandCallLogEntry) => {
  if (call.status === "success") return "ok";
  if (call.status === "error") return "error";
  return "running";
};

const formatCommandParams = (request: CommandExecuteRequest) => {
  if (!request.params) return "{}";
  return JSON.stringify(request.params, null, 2);
};

interface CommandLogProps {
  calls: CommandCallLogEntry[];
}

export const CommandLog = (props: CommandLogProps) => {
  const { calls } = props;

  return (
    <Box
      as="aside"
      aria-label="Command calls"
      bg="bg.panel"
      borderColor="border.subtle"
      display="grid"
      gridTemplateRows="auto minmax(0, 1fr)"
      minH="0"
      minW="0"
    >
      <Flex
        as="header"
        align="center"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        justify="space-between"
        px="3"
        py="2"
      >
        <Text as="h2" fontSize="sm" fontWeight="600">
          Commands
        </Text>
        <Text color="fg.muted" fontSize="xs">
          {calls.length}
        </Text>
      </Flex>
      <Flex direction="column" gap="2" minH="0" overflow="auto" p="2">
        {calls.length === 0 ? (
          <Text color="fg.muted" fontSize="sm">
            No calls yet
          </Text>
        ) : (
          calls.map((call) => (
            <Box
              as="article"
              bg="bg"
              borderColor="border.subtle"
              borderLeftColor={
                call.status === "success" ? "fg.success" : call.status === "error" ? "fg.error" : "border.subtle"
              }
              borderWidth="1px"
              display="flex"
              flexDirection="column"
              gap="2"
              key={call.id}
              p="2"
            >
              <Flex align="flex-start" gap="2" justify="space-between">
                <Text as="strong" fontSize="xs" fontWeight="600" lineHeight="1.4" overflowWrap="anywhere">
                  {call.commandId}
                </Text>
                <Text color="fg.muted" flexShrink="0" fontSize="xs" textTransform="uppercase">
                  {callStatusLabel(call)}
                </Text>
              </Flex>
              <Box
                as="pre"
                bg="bg.muted"
                color="fg"
                fontSize="xs"
                m="0"
                maxH="160px"
                overflow="auto"
                p="2"
                whiteSpace="pre-wrap"
                wordBreak="break-word"
              >
                {formatCommandParams(call.request)}
              </Box>
              {call.error ? (
                <Text color="fg.error" fontSize="xs">
                  {call.error}
                </Text>
              ) : null}
            </Box>
          ))
        )}
      </Flex>
    </Box>
  );
};
