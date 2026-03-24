import { Box } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import type { MouseEvent } from "react";
import type { DocsContent } from "../data/api";
import { DocsTemplateRenderer } from "../renderers/docs-template-renderer";
import type { DocsMenuEntry } from "../utils";
import { EmptyDocs } from "./empty-docs";
import { LoadingDocs } from "./loading-docs";

interface DocsPageContentProps {
  activeEntry: DocsMenuEntry | null;
  activeLink: string | null;
  content: DocsContent | undefined;
  contentError: unknown;
  isContentLoading: boolean;
  noContentLabel: string;
  onDocumentClick: (event: MouseEvent<HTMLDivElement>) => void;
  trySelectingAnotherLabel: string;
  unableToLoadDocumentLabel: string;
}

export const DocsPageContent = (props: DocsPageContentProps) => {
  const {
    activeEntry,
    activeLink,
    content,
    contentError,
    isContentLoading,
    noContentLabel,
    onDocumentClick,
    trySelectingAnotherLabel,
    unableToLoadDocumentLabel,
  } = props;

  if (isContentLoading) {
    return <LoadingDocs />;
  }

  if (!content && !contentError) {
    return <EmptyDocs />;
  }

  if (contentError) {
    return (
      <EmptyState
        title={unableToLoadDocumentLabel}
        description={contentError instanceof Error ? contentError.message : trySelectingAnotherLabel}
      />
    );
  }

  return (
    <Box width="100%" height="100%" onClick={onDocumentClick}>
      <DocsTemplateRenderer
        key={`${content?.path ?? activeLink ?? "docs-empty"}-${activeEntry?.template ?? "markdown"}`}
        content={content?.content ?? ""}
        template={activeEntry?.template}
        markdownPlaceholder={noContentLabel}
      />
    </Box>
  );
};
