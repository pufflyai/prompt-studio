import type { ShellCore } from "pstdio-shell/core";
import { useEffect } from "react";
import { BackToDashboard } from "@/features/project/components/back-to-dashboard";
import { ProjectMenu } from "@/features/project/components/project-menu";
import { PROJECT_NAVIGATION_HEADER_WIDGET_ID } from "./dashboard-project-shell";

type ProjectNavigationHeaderVariant = "project-menu" | "back-to-dashboard";

export const useProjectNavigationHeaderRenderer = (
  shell: Pick<ShellCore, "renderers">,
  variant: ProjectNavigationHeaderVariant = "project-menu",
) => {
  useEffect(() => {
    const projectHeader = shell.renderers.registerRenderer({
      id: PROJECT_NAVIGATION_HEADER_WIDGET_ID,
      render: () =>
        variant === "back-to-dashboard" ? (
          <BackToDashboard justifyContent="flex-start" borderRadius="0" px="sm" />
        ) : (
          <ProjectMenu />
        ),
    });

    return () => {
      projectHeader.dispose();
    };
  }, [shell, variant]);
};
