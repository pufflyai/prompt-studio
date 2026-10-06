import { Box, chakra } from "@chakra-ui/react";
import type { LandingPage } from "../../content/landing-pages";
import { useDocStyles } from "../../hooks/use-landing-styles";
import { PostBanner } from "./post-banner";
import { PostMeta } from "./post-meta";

interface PostListItemProps {
  page: Extract<LandingPage, { view: "post" }>;
  featured: boolean;
}

export const PostListItem = (props: PostListItemProps) => {
  const { page, featured } = props;
  const styles = useDocStyles();

  return (
    <chakra.a href={page.path} data-featured={featured || undefined} css={styles.postListItem}>
      {featured && <PostBanner image={page.image} />}
      <Box css={styles.postSummary}>
        <h2>{page.label}</h2>
        <PostMeta page={page} />
        <p>{page.description}</p>
      </Box>
    </chakra.a>
  );
};
