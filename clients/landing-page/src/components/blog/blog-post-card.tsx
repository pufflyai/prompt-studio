import { Flex, Image, Stack, Text } from "@chakra-ui/react";
import { AuthorTag } from "./author-tag";

interface BlogPostCardProps {
  link: string;
  category: string;
  date: string;
  title: string;
  image?: string;
  author: {
    name: string;
    role: string;
    avatar?: string;
  };
}

export const BlogPostCard = (props: BlogPostCardProps) => {
  const { title, image, date, category, author, link } = props;

  return (
    <a href={link}>
      <Stack role="group" gap="4" direction="column" cursor="pointer">
        <Flex overflow="hidden" borderRadius="xl">
          <Flex
            transition="all 0.2s"
            _groupHover={{ transform: "scale(1.05)" }}
            width={["100%", "100%", "20rem", "34rem"]}
            height="12rem"
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
        <Stack gap="4" paddingX="2">
          <Text textStyle="label/L/medium/uppercase">{category}</Text>
          <Text textStyle="heading/L">{title}</Text>
          <Text mb="1" textStyle="label/L/regular">
            {formatDate(date)}
          </Text>
          <AuthorTag name={author.name} role={author.role} avatar={author.avatar} />
        </Stack>
      </Stack>
    </a>
  );
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
