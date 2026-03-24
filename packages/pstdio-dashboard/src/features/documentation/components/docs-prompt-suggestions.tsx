import { Button, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { ChevronRight } from "lucide-react";

interface DocsPromptSuggestionsProps {
  prompts: string[];
  pendingPrompt?: string | null;
  onSelectPrompt?: (prompt: string) => void;
}

export const DocsPromptSuggestions = (props: DocsPromptSuggestionsProps) => {
  const { prompts, pendingPrompt = null, onSelectPrompt } = props;
  const isBusy = pendingPrompt !== null;

  return (
    <Stack width="100%" gap="2" align="stretch">
      {prompts.map((prompt) => (
        <Button
          key={prompt}
          variant="outline"
          size="sm"
          height="auto"
          minH="3rem"
          px="4"
          py="3"
          justifyContent="flex-start"
          whiteSpace="normal"
          loading={pendingPrompt === prompt}
          disabled={isBusy && pendingPrompt !== prompt}
          onClick={() => onSelectPrompt?.(prompt)}
        >
          <HStack width="100%" align="flex-start" gap="3">
            <Text flex="1" textAlign="left" textStyle="sm">
              {prompt}
            </Text>
            <Icon as={ChevronRight} boxSize="4" mt="0.5" color="fg.subtle" flexShrink="0" />
          </HStack>
        </Button>
      ))}
    </Stack>
  );
};
