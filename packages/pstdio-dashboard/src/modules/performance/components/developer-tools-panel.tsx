import { Stack, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

// The host's Developer tools panel. Extensions add their device-local controls below it.
export const DeveloperToolsPanel = () => {
  const { t } = useTranslation("settings");
  return (
    <Stack gap="2xs" padding="lg" maxW="720px">
      <Text textStyle="heading/S">{t("developerTools.title")}</Text>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        {t("developerTools.description")}
      </Text>
    </Stack>
  );
};
