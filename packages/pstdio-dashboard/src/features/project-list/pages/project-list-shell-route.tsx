import { ShellWorkbench } from "pstdio-shell/react";
import { useEffect } from "react";
import { PROJECTS_LIST_WIDGET_ID } from "@/shared/shell/dashboard-shell-modes";
import { useUnifiedShell } from "@/shared/shell/unified-shell-host";
import { ProjectList } from "./project-list";

export const ProjectListShellRoute = () => {
  const shell = useUnifiedShell();

  useEffect(() => {
    const renderer = shell.renderers.registerRenderer({
      id: PROJECTS_LIST_WIDGET_ID,
      render: () => <ProjectList />,
    });
    return () => renderer.dispose();
  }, [shell]);

  return <ShellWorkbench shell={shell} />;
};
