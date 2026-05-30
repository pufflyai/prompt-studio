import { Box, Button, Code, Flex, HStack, Text } from "@chakra-ui/react";
import { ShieldCheck, ShieldX } from "lucide-react";
import { ScrollArea } from "@/components/scroll-area";

interface ApprovalPromptProps {
  toolName: string;
  toolInput?: unknown;
  onApprove: () => void;
  onDeny: () => void;
}

const formatToolInput = (input: unknown) => {
  if (input == null) return null;

  const text = typeof input === "string" ? input : JSON.stringify(input, null, 2);
  if (text.length === 0) return null;

  const truncated = text.length > 200 ? `${text.slice(0, 200)}...` : text;
  return truncated;
};

export const ApprovalPrompt = (props: ApprovalPromptProps) => {
  const { toolName, toolInput, onApprove, onDeny } = props;
  const formattedInput = formatToolInput(toolInput);

  return (
    <Box px="sm" py="xs" mx="sm" borderWidth="1px" borderColor="border.warning" borderRadius="lg" bg="bg.warning">
      <Flex direction="column" gap="xs">
        <Text textStyle="label/S/medium" color="fg">
          Allow <Code size="sm">{toolName}</Code>?
        </Text>

        {formattedInput ? (
          <ScrollArea maxH="6rem">
            <Code size="sm" whiteSpace="pre-wrap" display="block" width="100%">
              {formattedInput}
            </Code>
          </ScrollArea>
        ) : null}

        <HStack gap="xs" justifyContent="flex-end">
          <Button size="xs" variant="outline" onClick={onDeny}>
            <ShieldX size={14} />
            Deny
          </Button>
          <Button size="xs" colorPalette="green" onClick={onApprove}>
            <ShieldCheck size={14} />
            Allow
          </Button>
        </HStack>
      </Flex>
    </Box>
  );
};
