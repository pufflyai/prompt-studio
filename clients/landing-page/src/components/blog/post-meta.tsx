import { Box } from "@chakra-ui/react";
import { ActivityAvatar } from "@pstdio/ui";
import type { LandingPage } from "../../content/landing-pages";
import { useDocStyles } from "../../hooks/use-landing-styles";
import { PostDate } from "./post-date";

interface PostMetaProps {
  page: Extract<LandingPage, { view: "post" }>;
}

export const PostMeta = (props: PostMetaProps) => {
  const { page } = props;
  const styles = useDocStyles();

  return (
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
  );
};
