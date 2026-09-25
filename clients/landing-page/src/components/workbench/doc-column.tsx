import { Box } from "@chakra-ui/react";
import { useDocStyles } from "../../hooks/use-landing-styles";
import { PageScroll } from "./page-scroll";

interface DocColumnProps {
  /** HTML that Astro compiled from a markdown file in `src/content/legal`. */
  html: string;
  pageKey: string;
}

export const DocColumn = (props: DocColumnProps) => {
  const { html, pageKey } = props;
  const styles = useDocStyles();

  return (
    <Box as="section" css={styles.column}>
      <PageScroll pageKey={pageKey}>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the HTML is compiled at build time from our own markdown in src/content/legal, never from user input. */}
        <Box as="article" css={styles.prose} dangerouslySetInnerHTML={{ __html: html }} />
      </PageScroll>
    </Box>
  );
};
