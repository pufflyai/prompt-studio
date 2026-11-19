import { Badge, HStack } from "@chakra-ui/react";
import type { ProjectExtensionInstance } from "@pstdio/sdk/api";
import { Tooltip } from "@pstdio/ui";
import { useTranslation } from "react-i18next";

interface ExtensionProvenanceProps {
  extension: Pick<ProjectExtensionInstance, "visibility"> & Partial<Pick<ProjectExtensionInstance, "ownership">>;
}

export const ExtensionProvenance = ({ extension }: ExtensionProvenanceProps) => {
  const { t } = useTranslation("projects");
  return (
    <HStack gap="xs" flexWrap="wrap">
      <Tooltip
        content={t(
          extension.visibility === "public"
            ? "projectSettings.extensionsPanel.provenance.publicHelp"
            : "projectSettings.extensionsPanel.provenance.unknownHelp",
        )}
      >
        <Badge data-extension-visibility={extension.visibility ?? "unknown"}>
          {t(
            extension.visibility === "public"
              ? "projectSettings.extensionsPanel.provenance.public"
              : "projectSettings.extensionsPanel.provenance.unknown",
          )}
        </Badge>
      </Tooltip>
      {extension.ownership === "mine" && (
        <Tooltip content={t("projectSettings.extensionsPanel.provenance.mineHelp")}>
          <Badge data-extension-ownership="mine">{t("projectSettings.extensionsPanel.provenance.mine")}</Badge>
        </Tooltip>
      )}
    </HStack>
  );
};
