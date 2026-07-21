import { Flex, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { createCopyFeedbackController } from "../../utils/copy-feedback";
import { CopyCommandIcon } from "../copy-command-icon";

interface TerminalBlockProps {
  commands: string[];
}

export const TerminalBlock = (props: TerminalBlockProps) => {
  const { commands } = props;

  const [isCopied, setIsCopied] = useState(false);
  const copyFeedbackControllerRef = useRef<ReturnType<typeof createCopyFeedbackController> | null>(null);

  if (!copyFeedbackControllerRef.current) {
    copyFeedbackControllerRef.current = createCopyFeedbackController(setIsCopied);
  }

  const copyFeedbackController = copyFeedbackControllerRef.current;

  useEffect(() => {
    return () => {
      copyFeedbackController.dispose();
    };
  }, [copyFeedbackController]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(commands.join("\n"));
    copyFeedbackController.markCopied();
  };

  return (
    <Flex
      width="100%"
      gap="12px"
      align="flex-start"
      px="14px"
      py="11px"
      bg="bg.code"
      borderWidth="1px"
      borderColor="border"
      rounded="6px"
    >
      <Stack gap="8px" flex="1" pt="2px">
        {commands.map((command) => (
          <HStack key={command} gap="10px" fontFamily="mono" fontSize="13px">
            <Text color="fg.subtle">$</Text>
            <Text as="code" color="fg">
              {command}
            </Text>
          </HStack>
        ))}
      </Stack>
      <IconButton aria-label="Copy commands" variant="ghost" size="xs" color="fg.muted" onClick={handleCopy}>
        <CopyCommandIcon isCopied={isCopied} />
      </IconButton>
    </Flex>
  );
};
