import { Box, Flex, Heading, HStack, Image, Stack, Text } from "@chakra-ui/react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Code2 } from "lucide-react";

export const SectionHeading = (props: { label: string; title: string; description?: string }) => {
  const { label, title, description } = props;

  return (
    <Stack gap="2">
      <Text color="fg.subtle" textStyle="label/M/medium" textTransform="uppercase">
        {label}
      </Text>
      <Heading as="h2" fontSize="2xl" fontWeight="600" letterSpacing="0">
        {title}
      </Heading>
      {description ? (
        <Text color="fg.muted" fontSize="md" lineHeight="1.7">
          {description}
        </Text>
      ) : null}
    </Stack>
  );
};

export const DocsCard = (props: { title: string; description: string; href?: string; icon: LucideIcon }) => {
  const { title, description, href, icon: Icon } = props;
  const content = (
    <Stack
      gap="4"
      borderWidth="1px"
      borderColor="border"
      bg="bg"
      p="5"
      rounded="sm"
      minH="11rem"
      transition="border-color 0.15s ease, transform 0.15s ease"
      _hover={href ? { borderColor: "fg.muted", transform: "translateY(-1px)" } : undefined}
    >
      <HStack justify="space-between" align="flex-start">
        <Box color="fg.muted">
          <Icon size={20} />
        </Box>
        {href ? <ArrowRight size={16} /> : null}
      </HStack>
      <Stack gap="2">
        <Text fontWeight="600">{title}</Text>
        <Text color="fg.muted" fontSize="sm" lineHeight="1.7">
          {description}
        </Text>
      </Stack>
    </Stack>
  );

  if (!href) {
    return content;
  }

  return (
    <Box as="a" href={href} display="block" color="inherit" textDecoration="none">
      {content}
    </Box>
  );
};

export const CodeExample = (props: { title: string; body: string }) => {
  const { title, body } = props;

  return (
    <Stack
      gap="0"
      borderWidth="1px"
      borderColor="blacks.750"
      rounded="sm"
      overflow="hidden"
      bg="blacks.900"
      color="blacks.50"
    >
      <Flex
        px="4"
        py="3"
        borderBottomWidth="1px"
        borderColor="blacks.750"
        align="center"
        justify="space-between"
        gap="3"
      >
        <Text fontSize="sm" fontWeight="600">
          {title}
        </Text>
        <Code2 size={16} />
      </Flex>
      <Box
        as="pre"
        m="0"
        p="4"
        overflowX="auto"
        bg="blacks.900"
        color="blacks.50"
        fontFamily="mono"
        fontSize="sm"
        lineHeight="1.7"
        whiteSpace="pre-wrap"
        overflowWrap="anywhere"
      >
        <code>{body}</code>
      </Box>
    </Stack>
  );
};

export const ScreenshotFigure = (props: { src: string; alt: string; caption: string; aspectRatio: string }) => {
  const { src, alt, caption, aspectRatio } = props;

  return (
    <Stack gap="3">
      <Box
        borderWidth="1px"
        borderColor="border"
        rounded="sm"
        overflow="hidden"
        bg="bg.subtle"
        aspectRatio={aspectRatio}
      >
        <Image src={src} alt={alt} display="block" width="100%" height="100%" objectFit="cover" />
      </Box>
      <Text color="fg.muted" fontSize="sm" lineHeight="1.6">
        {caption}
      </Text>
    </Stack>
  );
};
