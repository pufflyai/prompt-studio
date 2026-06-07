import { Box, Card, HStack, Icon, Stack } from "@chakra-ui/react";
import { Bot } from "lucide-react";
import { useTranslation } from "react-i18next";

interface HarnessDefaultModelCardProps {
  children: React.ReactNode;
}

export const HarnessDefaultModelCard = (props: HarnessDefaultModelCardProps) => {
  const { children } = props;
  const { t } = useTranslation("settings");

  return (
    <Card.Root size="sm" borderRadius="0" data-testid="harness-default-model-card">
      <Card.Body>
        <HStack gap="4" alignItems="flex-start">
          <Icon boxSize="1em" fontSize="2xl" flexShrink="0" color="fg.muted">
            <Bot />
          </Icon>
          <Box flex="1" minW="0">
            <Stack gap="1">
              <Card.Title textStyle="sm">{t("harnessesPanel.defaultModelTitle")}</Card.Title>
              <Card.Description>{t("harnessesPanel.defaultModelDescription")}</Card.Description>
            </Stack>
          </Box>
          <HStack gap="2" flexShrink="0" alignItems="center">
            {children}
          </HStack>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
};
