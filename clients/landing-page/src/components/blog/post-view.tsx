import { Box } from "@chakra-ui/react";
import { ActivityAvatar } from "@pstdio/ui";
import type { LandingDocument, LandingPage } from "../../content/landing-pages";
import { useDocStyles } from "../../hooks/use-landing-styles";
import { DocColumn, DocHtml } from "../workbench/doc-column";
import { PostBanner } from "./post-banner";
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
      <PostBanner image={page.image} />
      <header>
        <h1>{page.label}</h1>
        <Box css={styles.postMeta}>
          <Box css={styles.postAuthor}>
            <ActivityAvatar actor={page.author} />
            <span>{page.author.name}</span>
          </Box>
          <Box css={styles.postDetails}>
            <PostDate published={page.published} />
            <span aria-hidden="true">·</span>
            <span>{page.readingMinutes} min read</span>
          </Box>
        </Box>
      </header>
      <DocHtml html={document.html} />
    </DocColumn>
  );
};
