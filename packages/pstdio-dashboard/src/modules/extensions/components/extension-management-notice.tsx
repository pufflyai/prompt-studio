import { Text } from "@chakra-ui/react";
import type { ProjectExtensionInstance } from "@pstdio/sdk/api";
import { useTranslation } from "react-i18next";

interface ExtensionManagementNoticeProps {
  extension: Pick<ProjectExtensionInstance, "choiceRestriction" | "sourceRestriction">;
}

export const ExtensionManagementNotice = (props: ExtensionManagementNoticeProps) => {
  const { extension } = props;
  const { t } = useTranslation("projects");
  const restriction = extension.choiceRestriction ?? extension.sourceRestriction;
  if (!restriction) return null;
  let message = t("projectSettings.extensionsPanel.management.source");
  if (restriction === "policy-unavailable") message = t("projectSettings.extensionsPanel.management.unavailable");
  else if (extension.choiceRestriction) message = t("projectSettings.extensionsPanel.management.required");
  return (
    <Text textStyle="label/XS" color="fg.muted" data-testid="extension-management-notice">
      {message}
    </Text>
  );
};
