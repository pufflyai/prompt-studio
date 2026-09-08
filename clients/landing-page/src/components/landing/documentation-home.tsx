import { Box, Flex, Heading, HStack, Input, InputGroup, Stack, Text } from "@chakra-ui/react";
import { ChevronRight, FileText, Folder, Search } from "lucide-react";
import { useState } from "react";
import { REPOSITORY_DOCUMENTS } from "./repository-docs";

const DOCUMENTATION_FOLDERS = [
  { id: "product", label: "Product", description: "Guides for the CLI, workbench, SDK, and platform." },
  { id: "extensions", label: "Extensions", description: "Authoring guides and APIs for building extensions." },
  { id: "references", label: "References", description: "Command, SDK, and workbench lookups." },
];

interface DocumentationHomeProps {
  onNavigateDoc: (path: string) => void;
}

export const DocumentationHome = (props: DocumentationHomeProps) => {
  const { onNavigateDoc } = props;
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const searchResults = normalizedQuery
    ? REPOSITORY_DOCUMENTS.filter((document) =>
        `${document.title} ${document.path}`.toLowerCase().includes(normalizedQuery),
      )
    : [];

  return (
    <Box height="100%" width="100%" overflowY="auto">
      <Stack width="100%" maxWidth="820px" mx="auto" gap="0" px={{ base: "16px", md: "32px" }} py="20px">
        <Heading
          as="h1"
          fontFamily="heading"
          fontWeight="semibold"
          fontSize={{ base: "26px", md: "30px" }}
          lineHeight="1.15"
        >
          Project documentation
        </Heading>
        <Text fontFamily="body" fontSize="13px" lineHeight="1.5" color="fg.muted" mt="10px" maxWidth="640px">
          Everything you need to run Prompt Studio and build your own tools for it. The same Markdown files are
          available to the workbench, the CLI, and your agents.
        </Text>

        <InputGroup startElement={<Search size={14} />} mt="18px">
          <Input
            size="sm"
            value={query}
            placeholder="Search the documentation"
            aria-label="Search Prompt Studio documentation"
            onChange={(event) => setQuery(event.target.value)}
          />
        </InputGroup>

        <Stack gap="7px" mt="14px">
          {normalizedQuery
            ? searchResults.map((document) => (
                <HStack
                  key={document.path}
                  as="button"
                  minHeight="52px"
                  gap="12px"
                  px="12px"
                  py="9px"
                  textAlign="left"
                  borderWidth="1px"
                  borderColor="border"
                  rounded="6px"
                  _hover={{ bg: "bg.hover" }}
                  onClick={() => onNavigateDoc(document.path)}
                >
                  <FileText size={15} />
                  <Stack gap="1px" flex="1" minWidth="0">
                    <Text fontFamily="heading" fontSize="13px" fontWeight="medium" truncate>
                      {document.title}
                    </Text>
                    <Text fontFamily="mono" fontSize="9px" color="fg.subtle" truncate>
                      {document.path}
                    </Text>
                  </Stack>
                  <ChevronRight size={14} />
                </HStack>
              ))
            : DOCUMENTATION_FOLDERS.map((folder) => {
                const documents = REPOSITORY_DOCUMENTS.filter((document) => document.path.startsWith(`${folder.id}/`));
                const overview =
                  documents.find((document) => document.path === `${folder.id}/index.md`) ?? documents[0];

                return (
                  <HStack
                    key={folder.id}
                    as="button"
                    minHeight="62px"
                    gap="12px"
                    px="12px"
                    py="9px"
                    textAlign="left"
                    borderWidth="1px"
                    borderColor="border"
                    rounded="6px"
                    _hover={{ bg: "bg.hover" }}
                    onClick={() => overview && onNavigateDoc(overview.path)}
                  >
                    <Flex
                      width="32px"
                      height="32px"
                      flexShrink="0"
                      align="center"
                      justify="center"
                      bg="bg.hover"
                      rounded="5px"
                    >
                      <Folder size={15} />
                    </Flex>
                    <Stack gap="1px" flex="1" minWidth="0">
                      <HStack gap="7px">
                        <Text fontFamily="heading" fontSize="13px" fontWeight="medium">
                          {folder.label}
                        </Text>
                        <Text fontFamily="mono" fontSize="8px" color="fg.subtle">
                          {documents.length}
                        </Text>
                      </HStack>
                      <Text fontFamily="body" fontSize="11px" color="fg.muted" truncate>
                        {folder.description}
                      </Text>
                    </Stack>
                    <ChevronRight size={14} />
                  </HStack>
                );
              })}
          {normalizedQuery && searchResults.length === 0 && (
            <Text py="20px" fontFamily="body" fontSize="12px" color="fg.muted">
              No documents match “{query}”.
            </Text>
          )}
        </Stack>
      </Stack>
    </Box>
  );
};
