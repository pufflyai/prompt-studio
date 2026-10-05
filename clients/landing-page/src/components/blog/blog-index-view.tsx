import { Box } from "@chakra-ui/react";
import type { LandingPage } from "../../content/landing-pages";
import { useDocStyles } from "../../hooks/use-landing-styles";
import { DocColumn } from "../workbench/doc-column";
import { PostDate } from "./post-date";

interface BlogIndexViewProps {
  page: LandingPage;
  pages: LandingPage[];
}

export const BlogIndexView = (props: BlogIndexViewProps) => {
  const { page, pages } = props;
  const styles = useDocStyles();

  return (
    <DocColumn pageKey={page.path}>
      <h1>Blog</h1>
      <p>{page.description}</p>
      {pages.map(
        (post) =>
          post.view === "post" && (
            <section key={post.path}>
              <h2>
                <a href={post.path}>{post.label}</a>
              </h2>
              <Box css={styles.postMeta}>
                <PostDate published={post.published} />
              </Box>
              <p>{post.description}</p>
            </section>
          ),
      )}
    </DocColumn>
  );
};
