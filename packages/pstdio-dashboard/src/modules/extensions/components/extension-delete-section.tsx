import { Button, HStack, Separator, Stack, Text } from "@chakra-ui/react";
import type { ProjectExtensionInstance } from "@pstdio/sdk/api";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ExtensionDeleteSectionProps {
  scope: ProjectExtensionInstance["scope"];
  uninstalling?: boolean;
  onUninstall: () => void;
}

export const ExtensionDeleteSection = ({ scope, uninstalling, onUninstall }: ExtensionDeleteSectionProps) => {
  const { t } = useTranslation("projects");
  return (
    <Stack gap="lg">
      <Separator borderColor="border.subtle" />
      <Stack gap="2xs" paddingX="lg">
        <Text textStyle="label/XS/medium" color="fg.subtle" textTransform="uppercase" letterSpacing="0.06em">
          {t("projectSettings.extensionsPanel.detail.dangerZone")}
        </Text>
        <HStack justifyContent="space-between">
          <Text textStyle="label/XS" color="fg.muted">
            {t(
              scope === "global"
                ? "projectSettings.extensionsPanel.detail.deleteHintShared"
                : "projectSettings.extensionsPanel.detail.deleteHint",
            )}
          </Text>
          <Button
            variant="destructive"
            size="2xs"
            onClick={onUninstall}
            loading={uninstalling}
            data-testid="extension-delete"
          >
            <Trash2 size={12} />
            {t("projectSettings.extensionsPanel.delete")}
          </Button>
        </HStack>
      </Stack>
    </Stack>
  );
};
