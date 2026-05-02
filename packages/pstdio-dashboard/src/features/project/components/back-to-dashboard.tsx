import { Button } from "@chakra-ui/react";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { resolveProjectDefaultPath } from "../utils/project-default-path";

export const BackToDashboard = () => {
  const { projectId } = useParams({ strict: false });
  const { t } = useTranslation("projects");

  return (
    <Button size="sm" variant="ghost" asChild>
      <Link to={resolveProjectDefaultPath(projectId)}>
        <ArrowLeft size={14} />
        {t("shell.backToDashboard")}
      </Link>
    </Button>
  );
};
