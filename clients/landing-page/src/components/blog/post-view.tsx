import { Box } from "@chakra-ui/react";
import type { LandingDocument, LandingPage } from "../../content/landing-pages";
import { useDocStyles } from "../../hooks/use-landing-styles";
import { DocColumn, DocHtml } from "../workbench/doc-column";
import { PostDate } from "./post-date";

interface PostViewProps {
  page: Extract<LandingPage, { view: "post" }>;
  document: LandingDocument;
}

export const PostView = (props: PostViewProps) => {
  const { page, document } = props;
  const styles = useDocStyles();

  return (
    <DocColumn pageKey={page.path}>
      <header>
        <h1>{page.label}</h1>
        <Box css={styles.postMeta}>
          <PostDate published={page.published} /> · {page.author}
        </Box>
      </header>
      <DocHtml html={document.html} />
    </DocColumn>
  );
};
