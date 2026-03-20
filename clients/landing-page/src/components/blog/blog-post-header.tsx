import { Button, Container, Flex, Image, Stack, Text } from "@chakra-ui/react";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import Footer from "../footer";
import Header from "../header";
import { RootProvider } from "../root-provider";
import { AuthorTag } from "./author-tag";

interface BlogPostShellProps {
  title: string;
  description?: string;
  released: string;
  category: string;
  image?: string;
  author: {
    name: string;
    role: string;
    avatar?: string;
  };
  children: ReactNode;
}

function readingTime(text: string) {
  const wpm = 225;
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words / wpm);
}

const BlogPostShellContent = (props: BlogPostShellProps) => {
  const { title, description, released, category, image, author, children } = props;

  return (
    <Flex direction="column" minHeight="100vh">
      <Header />
      <Flex as="main" flex="1" direction="column" alignItems="center" mb={["2rem", "4rem", "8rem"]}>
        <Container maxW="4xl" px={["1.5rem", "3.75rem"]} width="100%">
          <Stack gap="1.8rem">
            <a href="/blog/">
              <Button fontWeight="regular" marginLeft="-1rem" variant="ghost" size="2xl">
                <ArrowLeft size={16} />
                {category}
              </Button>
            </a>

            {title && <Text textStyle="heading/display/L">{title}</Text>}

            <Text textStyle="label/L/medium/uppercase">{formatDate(released)}</Text>

            <AuthorTag name={author.name} role={author.role} avatar={author.avatar} />

            {description && <Text textStyle="label/L/regular">{description}</Text>}

            {image && (
              <Flex overflow="hidden" borderRadius="xl" minHeight={["12rem", "24rem"]}>
                <Image flex="1" borderRadius="md" width="100%" objectFit="cover" src={image} alt={title} />
              </Flex>
            )}

            <Container paddingX="0" maxW="90ch">
              {children}
            </Container>
          </Stack>
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
