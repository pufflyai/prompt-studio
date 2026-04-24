import { Button, Container, Flex, Stack, Text } from "@chakra-ui/react";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { ContentImageLightbox } from "../content-image-lightbox";
import Footer from "../footer";
import Header from "../header";
import { RootProvider } from "../root-provider";
import { AuthorTag } from "./author-tag";

interface BlogPostShellProps {
  title: string;
  released: string;
  category: string;
  author: {
    name: string;
    role: string;
    avatar?: string;
  };
  readingTimeMinutes: number;
  children: ReactNode;
}

const BlogPostShellContent = (props: BlogPostShellProps) => {
  const { title, released, category, author, readingTimeMinutes, children } = props;

  return (
    <Flex direction="column" minHeight="100vh">
      <Header activeSection="blog" />
      <Flex as="main" flex="1" direction="column" alignItems="center" mb={["2rem", "4rem", "8rem"]}>
        <Container maxW="4xl" px={["1.5rem", "3.75rem"]} width="100%">
          <Stack gap="sm" mb="2rem">
            <a href="/blog/">
              <Button fontWeight="regular" marginLeft="-1rem" variant="ghost" size="2xl">
                <ArrowLeft size={16} />
                {category}
              </Button>
            </a>

            {title && <Text textStyle="heading/display/L">{title}</Text>}

            <Flex alignItems="center" gap="2" flexWrap="wrap">
              <Text textStyle="label/L/medium/uppercase">{formatDate(released)}</Text>
              <Text color="fg.muted" textStyle="label/L/medium/uppercase">
                -
              </Text>
              <Text textStyle="label/L/medium/uppercase">{formatReadingTime(readingTimeMinutes)}</Text>
            </Flex>

            <AuthorTag name={author.name} role={author.role} avatar={author.avatar} />
          </Stack>
          <Container padding="0" margin="0" maxW="720px">
            <ContentImageLightbox>{children}</ContentImageLightbox>
          </Container>
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

export const BlogPostShell = (props: BlogPostShellProps) => {
  return (
    <RootProvider>
      <BlogPostShellContent {...props} />
    </RootProvider>
  );
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatReadingTime(minutes: number) {
  return `${minutes} min read`;
}
