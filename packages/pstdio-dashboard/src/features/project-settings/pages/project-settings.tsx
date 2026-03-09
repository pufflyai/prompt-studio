import { ContentPlaceholder, ContentPlaceholderLabel } from "@pstdio/ui";
import { useTranslation } from "react-i18next";

export const ProjectSettings = () => {
  const { t } = useTranslation("projects");

  return (
    <ContentPlaceholder>
      <ContentPlaceholderLabel>{t("projectSettings.title")}</ContentPlaceholderLabel>
    </ContentPlaceholder>
  );
};
