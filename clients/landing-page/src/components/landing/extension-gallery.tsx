import { Box, Flex, Heading, HStack, IconButton, Input, Link, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { OpenAiLogo } from "@phosphor-icons/react";
import { Tooltip } from "@pstdio/ui";
import { Github } from "lucide-react";
import { useState } from "react";
import { EXTENSION_CATEGORIES, EXTENSIONS, type ExtensionEntry } from "./content/extensions";
import { SectionRule } from "./section-rule";

const extensionCodeUrl = (extension: ExtensionEntry) =>
  `https://github.com/pufflyai/prompt-studio/tree/main/extensions/${extension.id}`;

const ExtensionCard = (props: { extension: ExtensionEntry }) => {
  const { extension } = props;

  const Icon = extension.icon;

  return (
    <Flex gap="14px" p="16px" bg="bg" borderWidth="1px" borderColor="border" rounded="8px" align="center">
      <Flex
        width="44px"
        height="44px"
        flexShrink="0"
        align="center"
        justify="center"
        bg="bg.hover"
        borderWidth="1px"
        borderColor="border"
        rounded="10px"
      >
        {Icon === "openai" ? <OpenAiLogo size={24} /> : <Icon size={24} />}
      </Flex>
      <Stack gap="2px" flex="1" minWidth="0">
        <Text fontFamily="heading" fontWeight="semibold" fontSize="15px">
          {extension.name}
        </Text>
        <Text fontFamily="body" fontSize="13px" lineHeight="1.4" color="fg.muted">
          {extension.description}
        </Text>
      </Stack>
      <HStack gap="8px" flexShrink="0">
        <Box px="9px" py="3px" bg="bg.hover" rounded="4px">
          <Text fontFamily="body" fontSize="11px" color="fg.muted">
            {extension.version}
          </Text>
        </Box>
        <Tooltip content="View source on GitHub">
          <IconButton asChild aria-label={`View ${extension.name} source`} variant="ghost" size="2xs">
            <Link href={extensionCodeUrl(extension)} target="_blank" rel="noopener">
              <Github size={13} />
            </Link>
          </IconButton>
        </Tooltip>
      </HStack>
    </Flex>
  );
};

export const ExtensionGallery = () => {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");

  const visible = EXTENSIONS.filter((extension) => {
    if (category !== "All" && extension.category !== category) return false;
    const text = `${extension.name} ${extension.description} ${extension.category}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });

  return (
    <Stack width="100%" gap="18px" pt="28px" pb="34px" px={{ base: "20px", md: "32px" }}>
      <SectionRule label="extend the workbench" />
      <Flex gap="28px" justify="space-between" align="flex-end" wrap="wrap">
        <Stack gap="7px">
          <Heading as="h1" fontFamily="heading" fontWeight="semibold" fontSize="28px" letterSpacing="-0.5px">
            Extension gallery
          </Heading>
          <Text fontFamily="body" fontSize="13px" color="fg.muted">
            Add tools, agent harnesses, themes, and workflows without leaving the workbench.
          </Text>
        </Stack>
        <Input
          width="250px"
          size="sm"
          placeholder="Search extensions…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </Flex>
      <HStack gap="7px" wrap="wrap">
        {["All", ...EXTENSION_CATEGORIES].map((label) => (
          <Box
            key={label}
            as="button"
            cursor="pointer"
            height="20px"
            px="7px"
            display="flex"
            alignItems="center"
            bg={category === label ? "bg.active" : "bg.hover"}
            color={category === label ? "fg" : "fg.muted"}
            borderWidth="1px"
            borderColor="border"
            rounded="4px"
            _hover={{ color: "fg" }}
            onClick={() => setCategory(label)}
          >
            <Text fontFamily="body" fontSize="11px">
              {label}
            </Text>
          </Box>
        ))}
      </HStack>
      <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="14px">
        {visible.map((extension) => (
          <ExtensionCard key={extension.id} extension={extension} />
        ))}
      </SimpleGrid>
      {visible.length === 0 && (
        <Text fontFamily="body" fontSize="13px" color="fg.muted">
          No extensions match your search.
        </Text>
      )}
    </Stack>
  );
};
