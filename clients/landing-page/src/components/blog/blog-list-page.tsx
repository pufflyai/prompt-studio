import { Container, Flex, Grid, Stack, Text } from "@chakra-ui/react";
import Footer from "../footer";
import Header from "../header";
import { RootProvider } from "../root-provider";
import { BlogPostCard } from "./blog-post-card";
import { BlogPostHighlight } from "./blog-post-highlight";

export interface BlogPostMeta {
  title: string;
  description: string;
  released: string;
  category: string;
  image?: string;
  author: {
    name: string;
    role: string;
    avatar?: string;
  };
}

interface BlogListPageProps {
  headline: string;
  posts: (BlogPostMeta & { slug: string })[];
}

const BlogListContent = (props: BlogListPageProps) => {
  const { headline, posts } = props;
  const [firstPost, ...remainingPosts] = posts;

  return (
    <Flex direction="column" minHeight="100vh">
      <Header activeSection="blog" />
      <Flex as="main" flex="1" direction="column" alignItems="center">
        <Container maxW="6xl" px={["1.5rem", "3.75rem"]} width="100%">
          <Stack pt={["2rem", "2rem", "4.375rem"]} gap="2rem">
            <Text textStyle="heading/display/L">{headline}</Text>
          </Stack>

          {firstPost && (
            <Flex pt={["2rem", "2rem", "4.375rem"]}>
              <a href={firstPost.slug}>
                <BlogPostHighlight
                  title={firstPost.title}
                  description={firstPost.description}
                  image={firstPost.image}
                  date={firstPost.released}
                  author={firstPost.author}
                />
              </a>
            </Flex>
          )}

          {remainingPosts.length > 0 && (
            <Grid
              pt={["2.5rem", "2.5rem", "4.375rem"]}
              pb="6rem"
              gridTemplateColumns={[
                "repeat(1, minmax(0px, 1fr))",
                "repeat(1, minmax(0px, 1fr))",
                "repeat(2, minmax(0px, 1fr))",
                "repeat(2, minmax(0px, 1fr))",
                "repeat(3, minmax(0px, 1fr))",
              ]}
              gap={12}
              alignItems="start"
            >
              {remainingPosts.map((post) => (
                <BlogPostCard
                  key={post.slug}
                  link={post.slug}
                  category={post.category}
                  image={post.image}
                  title={post.title}
                  description={post.description}
                  date={post.released}
                  author={post.author}
                />
              ))}
            </Grid>
          )}
        </Container>
      </Flex>
      <Footer
        links={[
          { item: "GitHub", url: "https://github.com/pufflyai/prompt-studio" },
          { item: "Discord", url: "https://discord.gg/3RxwUEk8fW" },
          { item: "Privacy Policy", url: "/privacy-policy/" },
          { item: "Terms", url: "/terms/" },
        ]}
      />
    </Flex>
  );
};

export const BlogListPage = (props: BlogListPageProps) => {
  return (
    <RootProvider>
      <BlogListContent {...props} />
    </RootProvider>
  );
};
