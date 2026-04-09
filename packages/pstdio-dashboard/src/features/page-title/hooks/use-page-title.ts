import { useRouterState, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { useProject } from "@/features/project/hooks/use-project";
import { useProjectSession } from "@/features/sessions/hooks/use-project-session";
import { getPageTitle } from "../utils/page-title";

const parseProjectRoute = (pathname: string) => {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "projects" || !segments[1]) return null;

  const projectId = segments[1];
  const section = segments[2];
  const sessionId = section === "sessions" ? (segments[3] ?? null) : null;

  return { projectId, section, sessionId };
};

export const usePageTitle = () => {
  const { location } = useRouterState();
  const { panel } = useSearch({ strict: false });

  const parsed = parseProjectRoute(location.pathname);

  const { data: project } = useProject(parsed?.projectId);
  const { data: session } = useProjectSession(parsed?.projectId, parsed?.sessionId ?? null);

  useEffect(() => {
    document.title = getPageTitle(location.pathname, project?.name, {
      settingsPanel: typeof panel === "string" ? panel : undefined,
      sessionTitle: session?.title,
    });
  }, [location.pathname, panel, project?.name, session?.title]);
};
