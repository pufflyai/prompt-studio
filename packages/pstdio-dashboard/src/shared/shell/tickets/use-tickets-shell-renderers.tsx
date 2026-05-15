import type { ShellCore } from "pstdio-shell/core";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { TICKETS_MAIN_WIDGET_ID } from "@/shared/shell/dashboard-tickets-shell";
import { useProjectNavigationHeaderRenderer } from "@/shared/shell/use-project-navigation-header-renderer";

interface UseTicketsShellRenderersInput {
  shell: Pick<ShellCore, "renderers">;
  renderMain: () => ReactNode;
}

export const useTicketsShellRenderers = (input: UseTicketsShellRenderersInput) => {
  const { shell, renderMain } = input;

  useProjectNavigationHeaderRenderer(shell);

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
