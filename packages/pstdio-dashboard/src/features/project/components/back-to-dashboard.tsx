import { Button, Flex } from "@chakra-ui/react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { resolveProjectDefaultPath } from "@/router";

export const BackToDashboard = () => {
  const { projectId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { t } = useTranslation("projects");

  const handleBack = () => {
    navigate({ to: resolveProjectDefaultPath(projectId) });
  };

  return (
    <Flex px="xs" pt="xs">
      <Button size="xs" variant="ghost" onClick={handleBack}>
        <ArrowLeft size={14} />
        {t("shell.backToDashboard")}
      </Button>
    </Flex>
  );
};
