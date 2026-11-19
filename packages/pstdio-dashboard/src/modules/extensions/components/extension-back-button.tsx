import { Button } from "@chakra-ui/react";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

export const ExtensionBackButton = ({ onBack, visible }: { onBack?: () => void; visible?: boolean }) => {
  const { t } = useTranslation("projects");
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (visible !== false) button.current?.focus();
  }, [visible]);
  if (!onBack) return null;
  return (
    <Button alignSelf="start" variant="ghost" size="xs" ref={button} onClick={onBack}>
      <ArrowLeft size={14} />
      {t("projectSettings.extensionsPanel.title")}
    </Button>
  );
};
