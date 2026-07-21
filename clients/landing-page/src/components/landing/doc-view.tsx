import { Box, Code, Heading, HStack, Image, Link, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

export type DocBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; code: string }
  | { type: "quote"; text: string }
  | { type: "image"; src: string; alt: string };

export interface DocPage {
  title: string;
  intro?: string;
  meta?: string;
  blocks: DocBlock[];
}

// renders the `**bold**`, `code`, and [label](url) spans used by the migrated markdown pages
const renderInline = (text: string): ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <Text key={index} as="strong" fontWeight="bold">
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <Code key={index} fontSize="0.94em" bg="bg.code" px="1" py="1px">
          {part.slice(1, -1)}
        </Code>
      );
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const external = link[2].startsWith("http");
      return (
        <Link
          key={index}
          href={link[2]}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener" : undefined}
          color="blue.600"
          _hover={{ textDecoration: "underline" }}
        >
          {link[1]}
        </Link>
      );
    }
    return part;
  });

const DocBlockView = (props: { block: DocBlock }) => {
  const { block } = props;

  if (block.type === "heading") {
    return (
      <Heading as="h2" fontFamily="body" fontSize="3xl" fontWeight="medium" lineHeight="120%" mt="9" mb="md">
        {block.text}
      </Heading>
    );
  }
  if (block.type === "paragraph") {
    return (
      <Text textStyle="paragraph/M/regular" my="3">
        {renderInline(block.text)}
      </Text>
    );
  }
  if (block.type === "list") {
    return (
      <Stack as="ul" gap="0" my="3" pl="1.5rem" listStyleType="disc" listStylePosition="outside">
        {block.items.map((item) => (
          <Text key={item} as="li" display="list-item" textStyle="paragraph/M/regular" pl="1">
            {renderInline(item)}
          </Text>
        ))}
      </Stack>
    );
  }
  if (block.type === "code") {
    return (
      <Box my="md" p="0.5rem" bg="bg.muted" rounded="xs" overflowX="auto">
        <Code display="block" whiteSpace="pre" bg="transparent" fontFamily="mono" fontSize="13px" lineHeight="1.53">
          {block.code}
        </Code>
      </Box>
    );
  }
  if (block.type === "quote") {
    return (
      <Box borderLeftWidth="4px" borderColor="border" pl="16px" py="3" my="lg" ml="md">
        <Text fontFamily="body" fontSize="15px" lineHeight="171%" color="fg.muted">
          {renderInline(block.text)}
        </Text>
      </Box>
    );
  }
  return (
    <Image
      src={block.src}
      alt={block.alt}
      my="4"
      width="100%"
      rounded="sm"
      borderWidth="1px"
      borderColor="border.subtle"
    />
  );
};

interface DocViewProps {
  page: DocPage;
}

export const DocView = (props: DocViewProps) => {
  const { page } = props;

  return (
    <Stack width="100%" maxWidth="46rem" gap="0" pt="48px" pb="56px" px={{ base: "20px", md: "32px" }}>
      <Text textStyle="heading/display/M" mb="md">
        {page.title}
      </Text>
      {page.meta && (
        <HStack mb="md">
          <Text textStyle="label/L/medium/uppercase" color="fg.muted">
            {page.meta}
          </Text>
        </HStack>
      )}
      {page.intro && (
        <Text textStyle="paragraph/L/regular" color="fg.muted" mb="3">
          {page.intro}
        </Text>
      )}
      {page.blocks.map((block, index) => (
        <DocBlockView key={index} block={block} />
      ))}
    </Stack>
  );
};
