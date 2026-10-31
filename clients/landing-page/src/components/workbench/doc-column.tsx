import { Box } from "@chakra-ui/react";
import { CopyButton } from "@pstdio/ui";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  return <CompiledDocHtml key={props.html} html={props.html} />;
};

const CompiledDocHtml = (props: DocHtmlProps) => {
  const { html } = props;
  const styles = useDocStyles();
  const root = useRef<HTMLDivElement>(null);
  const [blocks, setBlocks] = useState<HTMLPreElement[]>([]);
  // React must retain the compiled DOM while the copy controls render into it.
  const [markup] = useState(() => ({ __html: html }));

  // Compiled markdown stays intact; React owns only each block's copy control.
  useEffect(() => {
    setBlocks(Array.from(root.current?.querySelectorAll<HTMLPreElement>("pre:has(> code)") ?? []));
  }, []);

  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Astro compiles repository markdown at build time. */}
      <Box ref={root} css={styles.html} dangerouslySetInnerHTML={markup} />
      {blocks.map((block, index) =>
        createPortal(
          <CopyButton
            label="Copy code"
            size="2xs"
            css={styles.codeCopy}
            text={() => block.querySelector("code")?.textContent ?? ""}
          />,
          block,
          String(index),
        ),
      )}
    </>
  );
};
