import { Box, Flex, Stack } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { type MouseEvent, useEffect } from "react";
import { DocsSidebar } from "../components/docs-sidebar";
import { EmptyDocs } from "../components/empty-docs";
import { LoadingDocs } from "../components/loading-docs";
import { useDocsContent, useDocsIndex } from "../hooks/use-docs";
import { flattenDocsSidebar, resolveActiveDocLink, resolveDocsLinkFromHref } from "../utils";

export const DocsPanel = () => {
  const navigate = useNavigate();
  const { projectId } = useParams({ strict: false });
  const { doc: routeDoc } = useSearch({ strict: false });
  const resolvedProjectId = typeof projectId === "string" ? projectId : undefined;
  const { data: index, isLoading: isIndexLoading, error: indexError } = useDocsIndex(resolvedProjectId);
  const sidebarItems = index?.sidebar ?? [];
  const menuEntries = flattenDocsSidebar(sidebarItems);
  const activeLink = resolveActiveDocLink(routeDoc, menuEntries);
  const {
    data: content,
    isLoading: isContentLoading,
    error: contentError,
  } = useDocsContent(activeLink, resolvedProjectId);

  useEffect(() => {
    if (!activeLink || routeDoc === activeLink) {
      return;
    }

    if (resolvedProjectId) {
      navigate({
        to: "/projects/$projectId/docs",
        params: { projectId: resolvedProjectId },
        search: { doc: activeLink },
        replace: true,
      });
      return;
    }

    navigate({ to: "/docs", search: { doc: activeLink }, replace: true });
  }, [activeLink, navigate, resolvedProjectId, routeDoc]);

  const handleSelectLink = (link: string) => {
    if (link === activeLink) {
      return;
    }

    if (resolvedProjectId) {
      navigate({ to: "/projects/$projectId/docs", params: { projectId: resolvedProjectId }, search: { doc: link } });
      return;
    }

    navigate({ to: "/docs", search: { doc: link } });
  };

  const handleDocumentClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const anchor = target.closest("a");
    const href = anchor?.getAttribute("href");

    if (!href) {
      return;
    }

    const nextLink = resolveDocsLinkFromHref(href, activeLink);
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
        title="Unable to load docs"
        description={indexError instanceof Error ? indexError.message : "Try again."}
      />
    );
  }

  if (menuEntries.length === 0) {
    return <EmptyDocs />;
  }

  if (isContentLoading) {
    return <LoadingDocs />;
  }

  if (!content && !contentError) {
    return <EmptyDocs />;
  }

  const pageContent = contentError ? (
    <EmptyState
      title="Unable to load document"
      description={contentError instanceof Error ? contentError.message : "Try selecting another doc."}
    />
  ) : (
    <Box width="100%" height="100%" onClick={handleDocumentClick}>
      <MarkdownEditor
        key={content?.path ?? activeLink ?? "docs-empty"}
        defaultState={content?.content ?? ""}
        isEditable={false}
        placeholder="No content available."
      />
    </Box>
  );

  return (
    <Flex height="100%" width="100%" minH="0">
      <Box width="320px" minW="280px" maxW="360px" borderRightWidth="1px" borderColor="border.secondary" p="sm">
        <DocsSidebar menuItems={sidebarItems} activeLink={activeLink} onSelectLink={handleSelectLink} />
      </Box>
      <Stack height="100%" flex="1" minH="0" p="sm">
        {pageContent}
      </Stack>
    </Flex>
  );
};
