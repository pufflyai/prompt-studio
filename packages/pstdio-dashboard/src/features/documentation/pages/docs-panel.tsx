import { Box, Stack } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { type MouseEvent, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { OpenSidebarButton } from "@/features/project/components/open-sidebar-button";
import { EmptyDocs } from "../components/empty-docs";
import { LoadingDocs } from "../components/loading-docs";
import { useDocsContent, useDocsIndex } from "../hooks/use-docs";
import { DocsTemplateRenderer } from "../renderers/docs-template-renderer";
import { flattenDocsSidebar, resolveActiveDocEntry, resolveDocsLinkFromHref } from "../utils";

const navigateToDocLink = (input: {
  link: string;
  navigate: ReturnType<typeof useNavigate>;
  projectId: string | undefined;
  replace?: boolean;
}) => {
  const { link, navigate, projectId, replace = false } = input;
  if (projectId) {
    navigate({ to: "/projects/$projectId/docs", params: { projectId }, search: { doc: link }, replace });
    return;
  }

  navigate({ to: "/docs", search: { doc: link }, replace });
};

const resolveErrorDescription = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};

const resolveClickedDocLink = (target: EventTarget | null, activeLink: string | null) => {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  const anchor = target.closest("a");
  const href = anchor?.getAttribute("href");
  if (!href) {
    return null;
  }

  return resolveDocsLinkFromHref(href, activeLink);
};

interface ResolvePageContentInput {
  activeLink: string | null;
  content:
    | {
        content?: string | null;
        path?: string | null;
      }
    | null
    | undefined;
  contentError: Error | null;
  handleDocumentClick: (event: MouseEvent<HTMLDivElement>) => void;
  isContentLoading: boolean;
  t: (key: string) => string;
  template: string | undefined;
}

const resolvePageContent = (input: ResolvePageContentInput) => {
  const { activeLink, content, contentError, handleDocumentClick, isContentLoading, t, template } = input;

  if (isContentLoading) {
    return <LoadingDocs />;
  }

  if (!content && !contentError) {
    return <EmptyDocs />;
  }

  if (contentError) {
    return (
      <EmptyState
        title={t("docs.unableToLoadDocument")}
        description={resolveErrorDescription(contentError, t("docs.trySelectingAnother"))}
      />
    );
  }

  return (
    <Box width="100%" height="100%" onClick={handleDocumentClick}>
      <DocsTemplateRenderer
        key={`${content?.path ?? activeLink ?? "docs-empty"}-${template ?? "markdown"}`}
        content={content?.content ?? ""}
        template={template}
        markdownPlaceholder={t("docs.noContentAvailable")}
      />
    </Box>
  );
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

    navigateToDocLink({ link: activeLink, navigate, projectId: resolvedProjectId, replace: true });
  }, [activeLink, navigate, resolvedProjectId, routeDoc]);

  const handleSelectLink = (link: string) => {
    if (link === activeLink) {
      return;
    }

    navigateToDocLink({ link, navigate, projectId: resolvedProjectId });
  };

  const handleDocumentClick = (event: MouseEvent<HTMLDivElement>) => {
    const nextLink = resolveClickedDocLink(event.target, activeLink);
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
      <EmptyState title={t("docs.unableToLoadDocs")} description={resolveErrorDescription(indexError, "Try again.")} />
    );
  }

  if (menuEntries.length === 0) {
    return <EmptyDocs />;
  }

  const pageContent = resolvePageContent({
    activeLink,
    content: content ?? null,
    contentError,
    handleDocumentClick,
    isContentLoading,
    t,
    template: activeEntry?.template,
  });

  return (
    <Stack height="100%" flex="1" minH="0" position="relative">
      <OpenSidebarButton />
      {pageContent}
    </Stack>
  );
};
