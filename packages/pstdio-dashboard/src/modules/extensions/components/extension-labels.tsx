import { Badge, Icon, Text } from "@chakra-ui/react";
import type { ExtensionAuthor } from "@pstdio/sdk/api";
import { Blocks, Building2, Folder, Folders, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { extensionAuthorKey } from "./extension-filters";

export const ExtensionAuthorBadge = ({ author }: { author?: ExtensionAuthor }) => {
  const { t } = useTranslation("projects");
  if (!author) return null;
  const firstParty = author.kind === "publisher" && author.publisher === "pstdio";
  let label = t("projectSettings.extensionsPanel.author.me");
  let icon = UserRound;
  if (author.kind === "publisher") {
    label = firstParty ? t("projectSettings.extensionsPanel.author.promptStudio") : author.publisher;
    icon = firstParty ? Blocks : Building2;
  }
  const middle = Math.max(0, label.length - 12);
  return (
    <Badge variant="chip" size="sm" maxW="full" minW="0" data-extension-author={extensionAuthorKey(author)}>
      <Icon as={icon} boxSize="3" flexShrink="0" />
      <Text as="span" display="flex" minW="0" title={label}>
        <Text as="span" truncate>
          {label.slice(0, middle)}
        </Text>
        <Text as="span" flexShrink="0">
          {label.slice(middle)}
        </Text>
      </Text>
    </Badge>
  );
};

export const ExtensionScopeBadge = ({ scope }: { scope: "repo" | "global" }) => {
  const { t } = useTranslation("projects");
  return (
    <Badge variant="chip" size="sm" data-extension-scope={scope}>
      <Icon as={scope === "repo" ? Folder : Folders} boxSize="3" />
      {t(`projectSettings.extensionsPanel.scope.${scope}`)}
    </Badge>
  );
};
