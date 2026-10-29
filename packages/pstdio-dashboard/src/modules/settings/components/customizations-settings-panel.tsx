import { Stack, Text } from "@chakra-ui/react";
import type { WorkbenchCore } from "@pstdio/workbench";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AppearanceSettingsSection } from "./appearance-settings-section";
import { OnboardingSettingsSection } from "./onboarding-settings-section";

export const CustomizationsSettingsContent = (props: { workbench: WorkbenchCore; onboarding: ReactNode }) => {
  const { workbench, onboarding } = props;
  const { t } = useTranslation("common");
  return (
    <Stack gap="lg" padding="lg" maxW="chat-content">
      <Text as="h1" textStyle="heading/S">
        {t("onboarding.customizations")}
      </Text>
      <AppearanceSettingsSection workbench={workbench} />
      {onboarding}
    </Stack>
  );
};
export const CustomizationsSettingsPanel = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  return <CustomizationsSettingsContent workbench={workbench} onboarding={<OnboardingSettingsSection />} />;
};
