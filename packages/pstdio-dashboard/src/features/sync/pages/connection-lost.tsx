import { Button, Container, Stack, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

export const ConnectionLost = () => {
  const { t } = useTranslation();

  const handleRetry = () => {
    window.location.href = "/";
  };

  return (
    <Container centerContent py="2xl">
      <Stack gap="lg" align="center" textAlign="center">
        <Stack gap="2xs">
          <Text textStyle="heading/M">{t("connectionLost.title")}</Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {t("connectionLost.description")}
          </Text>
        </Stack>
        <Button variant="solid" size="sm" onClick={handleRetry}>
          {t("connectionLost.retry")}
        </Button>
      </Stack>
    </Container>
  );
};
