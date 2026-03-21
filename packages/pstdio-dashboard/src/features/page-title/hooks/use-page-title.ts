import { useRouterState, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { useDocsIndex } from "@/features/documentation/hooks/use-docs";
import { flattenDocsSidebar, resolveActiveDocEntry } from "@/features/documentation/utils";
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

const useDocTitle = (projectId: string | undefined, section: string | undefined, doc: unknown) => {
  const { data: index } = useDocsIndex(section === "docs" ? projectId : undefined);
  if (!index?.sidebar) return undefined;

  const entries = flattenDocsSidebar(index.sidebar);
  const activeEntry = resolveActiveDocEntry(doc, entries);
  return activeEntry?.itemText;
};

export const usePageTitle = () => {
  const { location } = useRouterState();
  const { panel, doc } = useSearch({ strict: false });

  const parsed = parseProjectRoute(location.pathname);

  const { data: project } = useProject(parsed?.projectId);
  const { data: session } = useProjectSession(parsed?.projectId, parsed?.sessionId ?? null);
  const docTitle = useDocTitle(parsed?.projectId, parsed?.section, doc);

  useEffect(() => {
    document.title = getPageTitle(location.pathname, project?.name, {
      settingsPanel: typeof panel === "string" ? panel : undefined,
      sessionTitle: session?.title,
      docTitle,
    });
  }, [location.pathname, panel, project?.name, session?.title, docTitle]);
};
