import { Button } from "@chakra-ui/react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

export const ExtensionBackButton = ({ onBack }: { onBack?: () => void }) => {
  const { t } = useTranslation("projects");
  if (!onBack) return null;
  return (
    <Button alignSelf="start" variant="ghost" size="xs" autoFocus onClick={onBack}>
      <ArrowLeft size={14} />
      {t("projectSettings.extensionsPanel.title")}
    </Button>
  );
};
