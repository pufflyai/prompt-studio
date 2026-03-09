import { Center } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import { useTranslation } from "react-i18next";

export const EmptyDocs = () => {
  const { t } = useTranslation();

  return (
    <Center width="100%" minH="240px" height="100%">
      <EmptyState title={t("docs.noDocsFound")} description="" />
    </Center>
  );
};
