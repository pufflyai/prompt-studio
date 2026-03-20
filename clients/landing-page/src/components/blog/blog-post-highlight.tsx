import { Flex, Image, Stack, Text } from "@chakra-ui/react";
import { AuthorTag } from "./author-tag";

interface BlogPostHighlightProps {
  date: string;
  title: string;
  image?: string;
  author: {
    name: string;
    role: string;
    avatar?: string;
  };
}

export const BlogPostHighlight = (props: BlogPostHighlightProps) => {
  const { title, image, date, author } = props;

  return (
    <Stack role="group" gap={["2", "2", "20"]} direction={["column", "column", "row"]} cursor="pointer">
      <Flex overflow="hidden" borderRadius="xl">
        <Flex
          transition="all 0.2s"
          _groupHover={{ transform: "scale(1.05)" }}
          width={["100%", "100%", "20rem", "34rem"]}
          height={["12rem", "12rem", "20rem"]}
        >
          {image && (
            <Image
              flex="1"
              transition="all 0.2s"
              borderRadius="2xl"
              objectFit="cover"
              objectPosition="50% 50%"
              src={image}
              alt={title}
            />
          )}
        </Flex>
      </Flex>
      <Stack gap="4" mt="2">
        <Text textStyle="label/L/medium/uppercase">Latest</Text>
        <Text textStyle="heading/display/M" fontWeight="semibold">
          {title}
        </Text>
        <Text mb="3" mt="1" textStyle="label/L/regular">
          {formatDate(date)}
        </Text>
        <AuthorTag name={author.name} role={author.role} avatar={author.avatar} />
      </Stack>
    </Stack>
  );
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
