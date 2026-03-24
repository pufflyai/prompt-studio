import { Stack } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { type MouseEvent, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { OpenSidebarButton } from "@/features/project/components/open-sidebar-button";
import { DocsPageContent } from "../components/docs-page-content";
import { EmptyDocs } from "../components/empty-docs";
import { LoadingDocs } from "../components/loading-docs";
import { useDocsContent, useDocsIndex } from "../hooks/use-docs";
import { flattenDocsSidebar, resolveActiveDocEntry, resolveDocsLinkFromHref } from "../utils";

const navigateToDoc = (navigate: ReturnType<typeof useNavigate>, link: string, projectId?: string, replace = false) => {
  if (projectId) {
    navigate({
      to: "/projects/$projectId/docs",
      params: { projectId },
      search: { doc: link },
      replace,
    });
    return;
  }

  navigate({ to: "/docs", search: { doc: link }, replace });
};

const resolveClickedDocsLink = (target: EventTarget | null, currentLink: string | null) => {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  const href = target.closest("a")?.getAttribute("href");
  if (!href) {
    return null;
  }

  return resolveDocsLinkFromHref(href, currentLink);
};

export const DocsPanel = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projectId } = useParams({ strict: false });
  const { doc: routeDoc } = useSearch({ strict: false });
  const resolvedProjectId = typeof projectId === "string" ? projectId : undefined;
  const { data: index, isLoading: isIndexLoading, error: indexError } = useDocsIndex(resolvedProjectId);
  const sidebarItems = index?.sidebar ?? [];
  const menuEntries = flattenDocsSidebar(sidebarItems);
  const activeEntry = resolveActiveDocEntry(routeDoc, menuEntries);
  const activeLink = activeEntry?.link ?? null;
  const {
    data: content,
    isLoading: isContentLoading,
    error: contentError,
  } = useDocsContent(activeLink, resolvedProjectId);

  useEffect(() => {
    if (!activeLink || routeDoc === activeLink) {
      return;
    }

    navigateToDoc(navigate, activeLink, resolvedProjectId, true);
  }, [activeLink, navigate, resolvedProjectId, routeDoc]);

  const handleSelectLink = (link: string) => {
    if (link === activeLink) {
      return;
    }

    navigateToDoc(navigate, link, resolvedProjectId);
  };

  const handleDocumentClick = (event: MouseEvent<HTMLDivElement>) => {
    const nextLink = resolveClickedDocsLink(event.target, activeLink);
    if (!nextLink) {
      return;
    }

    event.preventDefault();
    handleSelectLink(nextLink);
  };

  if (isIndexLoading) {
    return <LoadingDocs />;
  }

  if (indexError) {
    return (
      <EmptyState
        title={t("docs.unableToLoadDocs")}
        description={indexError instanceof Error ? indexError.message : "Try again."}
      />
    );
  }

  if (menuEntries.length === 0) {
    return <EmptyDocs />;
  }

  return (
    <Stack height="100%" flex="1" minH="0" position="relative">
      <OpenSidebarButton />
      <DocsPageContent
        activeEntry={activeEntry}
        activeLink={activeLink}
        content={content}
        contentError={contentError}
        isContentLoading={isContentLoading}
        noContentLabel={t("docs.noContentAvailable")}
        onDocumentClick={handleDocumentClick}
        trySelectingAnotherLabel={t("docs.trySelectingAnother")}
        unableToLoadDocumentLabel={t("docs.unableToLoadDocument")}
      />
    </Stack>
  );
};
