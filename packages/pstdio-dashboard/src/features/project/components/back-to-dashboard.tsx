import { Button, type ButtonProps } from "@chakra-ui/react";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { resolveProjectDefaultPath } from "../utils/project-default-path";

type BackToDashboardProps = ButtonProps;

export const BackToDashboard = (props: BackToDashboardProps) => {
  const { ...buttonProps } = props;
  const { projectId } = useParams({ strict: false });
  const { t } = useTranslation("projects");

  return (
    <Button size="sm" variant="ghost" asChild {...buttonProps}>
      <Link to={resolveProjectDefaultPath(projectId)}>
        <ArrowLeft size={14} />
        {t("shell.backToDashboard")}
      </Link>
    </Button>
  );
};
