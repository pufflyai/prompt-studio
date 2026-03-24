import { Center, Container, Icon, Stack, Text } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DocsPromptSuggestions } from "./docs-prompt-suggestions";

const QUESTION_KEYS = [
  "docs.empty.questionPurpose",
  "docs.empty.questionEntryPoints",
  "docs.empty.questionRunValidate",
  "docs.empty.questionDependencies",
  "docs.empty.questionRunbooks",
] as const;

interface EmptyDocsContentProps {
  canStartSession?: boolean;
  pendingPrompt?: string | null;
  onSelectPrompt?: (prompt: string) => void;
}

export const EmptyDocsContent = (props: EmptyDocsContentProps) => {
  const { canStartSession = true, pendingPrompt, onSelectPrompt } = props;
  const { t } = useTranslation();
  const prompts = QUESTION_KEYS.map((key) => t(key));

  return (
    <Center minH="240px" height="100%" px={{ base: "4", lg: "8" }} py={{ base: "8", lg: "10" }}>
      <Container maxW="3xl">
        <EmptyState
          title={t("docs.empty.title")}
          description={t("docs.empty.suggestionsTitle")}
          icon={<Icon as={FileText} boxSize="6" color="fg.muted" />}
          width="100%"
        >
          <Stack width="100%" gap="4" mt="4">
            {canStartSession ? (
              <DocsPromptSuggestions prompts={prompts} pendingPrompt={pendingPrompt} onSelectPrompt={onSelectPrompt} />
            ) : (
              <Text textStyle="sm" color="fg.subtle" textAlign="center">
                {t("docs.empty.suggestionsProjectHint")}
              </Text>
            )}
          </Stack>
        </EmptyState>
      </Container>
    </Center>
  );
};
