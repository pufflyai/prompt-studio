import { Button, Container, Stack, Text } from "@chakra-ui/react";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { useTranslation } from "react-i18next";

export const ConnectionLost = () => {
  const { t } = useTranslation();

  const handleRetry = () => {
    window.location.href = "/";
  };

  // SyncProvider renders this above the workbench's ChakraProvider, so the
  // reconnect screen brings its own Chakra context — otherwise a dropped sync
  // stream crashes the whole app instead of showing this page.
  return (
    <ChakraProvider value={psTheme}>
      <Container centerContent py="2xl">
        <Stack gap="lg" align="center" textAlign="center">
          <Stack gap="2xs">
            <Text textStyle="heading/M">{t("connectionLost.title")}</Text>
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              {t("connectionLost.description")}
            </Text>
          </Stack>
          <Button variant="primary" size="sm" onClick={handleRetry}>
            {t("connectionLost.retry")}
          </Button>
        </Stack>
      </Container>
    </ChakraProvider>
  );
};
