import { Button, Flex } from "@chakra-ui/react";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { resolveProjectDefaultPath } from "@/router";

export const BackToDashboard = () => {
  const { projectId } = useParams({ strict: false });
  const { t } = useTranslation("projects");

  return (
    <Flex px="xs" pt="xs">
      <Button size="xs" variant="ghost" asChild>
        <Link to={resolveProjectDefaultPath(projectId)}>
          <ArrowLeft size={14} />
          {t("shell.backToDashboard")}
        </Link>
      </Button>
    </Flex>
  );
};
