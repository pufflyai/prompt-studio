import { Button, Flex } from "@chakra-ui/react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

export const BackToProjects = () => {
  const { t } = useTranslation("settings");

  return (
    <Flex px="xs" pt="xs">
      <Button size="xs" variant="ghost" asChild>
        <Link to="/projects">
          <ArrowLeft size={14} />
          {t("agentList.back")}
        </Link>
      </Button>
    </Flex>
  );
};
