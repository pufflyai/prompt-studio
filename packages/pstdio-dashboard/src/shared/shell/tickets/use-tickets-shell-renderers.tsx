import type { ShellCore } from "pstdio-shell/core";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { createTicketsResource, TICKETS_MAIN_WIDGET_ID } from "@/shared/shell/tickets/dashboard-tickets-module";
import { useProjectNavigationHeaderRenderer } from "@/shared/shell/use-project-navigation-header-renderer";

interface UseTicketsShellRenderersInput {
  projectId: string;
  shell: Pick<ShellCore, "layout" | "renderers">;
  renderMain: () => ReactNode;
}

export const useTicketsShellRenderers = (input: UseTicketsShellRenderersInput) => {
  const { projectId, shell, renderMain } = input;

  useProjectNavigationHeaderRenderer(shell);

  useEffect(() => {
    if (!projectId) return;

    shell.layout.openWidget(TICKETS_MAIN_WIDGET_ID, {
      resource: createTicketsResource(projectId),
    });
  }, [projectId, shell]);

  useEffect(() => {
    const main = shell.renderers.registerRenderer({
      id: TICKETS_MAIN_WIDGET_ID,
      render: renderMain,
    });

    return () => {
      main.dispose();
    };
  });
};
