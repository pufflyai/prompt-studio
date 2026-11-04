import { Stack, Text } from "@chakra-ui/react";
import type { WorkbenchCore } from "@pstdio/workbench";
import { useTranslation } from "react-i18next";
import { AppearanceSettingsSection } from "./appearance-settings-section";

export const CustomizationsSettingsContent = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const { t } = useTranslation("common");
  return (
    <Stack gap="lg" padding="lg" maxW="chat-content">
      <Text as="h1" textStyle="heading/S">
        {t("projectOpening.customizations")}
      </Text>
      <AppearanceSettingsSection workbench={workbench} />
    </Stack>
  );
};
export const CustomizationsSettingsPanel = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  return <CustomizationsSettingsContent workbench={workbench} />;
};
