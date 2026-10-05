import { Box } from "@chakra-ui/react";
import { type ReactNode, useEffect } from "react";
import { useDocStyles } from "../../hooks/use-landing-styles";
import { PageScroll } from "./page-scroll";

interface DocColumnProps {
  children: ReactNode;
  pageKey: string;
  /** Shown beside the article on wide screens, such as the docs outline. */
  aside?: ReactNode;
}

/** The one-column reading layout for legal pages, docs, and the blog. */
export const DocColumn = (props: DocColumnProps) => {
  const { children, pageKey, aside } = props;
  const styles = useDocStyles();

  // Scroll to a linked heading after the new document and scroll area mount.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs again for every document that shows.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) window.document.getElementById(id)?.scrollIntoView();
  }, [pageKey]);

  return (
    <Box as="section" css={styles.column}>
      <PageScroll pageKey={pageKey}>
        <Box css={styles.layout}>
          <Box as="article" css={styles.prose}>
            {children}
          </Box>
          {aside}
        </Box>
      </PageScroll>
    </Box>
  );
};

interface DocHtmlProps {
  /** HTML that Astro compiled from repo markdown at build time. */
  html: string;
}

export const DocHtml = (props: DocHtmlProps) => {
  const { html } = props;
  const styles = useDocStyles();

  // biome-ignore lint/security/noDangerouslySetInnerHtml: the HTML is compiled at build time from markdown in this repo, never from user input.
  return <Box css={styles.html} dangerouslySetInnerHTML={{ __html: html }} />;
};
