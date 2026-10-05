import { Box, chakra, Image } from "@chakra-ui/react";
import type { LandingPage } from "../../content/landing-pages";
import { useDocStyles } from "../../hooks/use-landing-styles";
import { PostMeta } from "./post-meta";

interface PostListItemProps {
  page: Extract<LandingPage, { view: "post" }>;
}

export const PostListItem = (props: PostListItemProps) => {
  const { page } = props;
  const styles = useDocStyles();

  return (
    <Box as="section" css={styles.postListItem}>
      <chakra.a href={page.path} aria-label={`Read ${page.label}`} css={styles.postThumbnail}>
        <Image
          src={page.image.src}
          htmlWidth={page.image.width}
          htmlHeight={page.image.height}
          alt=""
          loading="lazy"
          decoding="async"
        />
      </chakra.a>
      <Box css={styles.postSummary}>
        <h2>
          <a href={page.path}>{page.label}</a>
        </h2>
        <PostMeta page={page} />
        <p>{page.description}</p>
      </Box>
    </Box>
  );
};
