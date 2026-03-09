import { ContentPlaceholder, ContentPlaceholderLabel } from "@pstdio/ui";
import { useTranslation } from "react-i18next";

export const WorkspacePage = () => {
  const { t } = useTranslation();

  return (
    <ContentPlaceholder>
      <ContentPlaceholderLabel>{t("workspace.title")}</ContentPlaceholderLabel>
    </ContentPlaceholder>
  );
};
