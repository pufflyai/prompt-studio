import { Box, Button, HStack, Spinner, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
export const SetupLoading = ({ onSkip }: { onSkip(): void }) => {
  const { t } = useTranslation("common");
  return (
    <>
      <HStack as="header" px="md" py="sm" justify="space-between">
        <Text textStyle="heading/dialog">{t("onboarding.loading")}</Text>
        <Button size="sm" variant="ghost" onClick={onSkip}>
          {t("onboarding.skip")}
        </Button>
      </HStack>
      <Box flex="1" p="md">
        <HStack role="status" aria-label={t("onboarding.loading")} justify="center">
          <Spinner size="sm" />
        </HStack>
      </Box>
    </>
  );
};
