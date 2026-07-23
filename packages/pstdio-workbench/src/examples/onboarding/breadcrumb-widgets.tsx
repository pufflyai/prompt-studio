import { Box, Button, Code, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { ResourceRef, WorkbenchCore } from "../../core";
import { WorkbenchIcon } from "../../react/shared/icon";
import {
  docsResource,
  findPageBySectionPath,
  findSection,
  pageResource,
  sectionResource,
  sections,
} from "./breadcrumb-data";

const NavCard = (props: { icon?: string; title: string; description?: string; onClick: () => void }) => {
  const { icon, title, description, onClick } = props;

  return (
    <Box
      as="button"
      onClick={onClick}
      textAlign="left"
      w="full"
      p="md"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="md"
      bg="bg"
      _hover={{ bg: "bg.subtle", borderColor: "border.emphasized" }}
    >
      <HStack gap="sm" align="flex-start">
        {icon ? (
          <Text as="span" color="fg.muted" mt="3xs">
            <WorkbenchIcon name={icon} size={18} />
          </Text>
        ) : null}
        <Stack gap="3xs" minW="0">
          <Text textStyle="title/XS/semibold">{title}</Text>
          {description ? (
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              {description}
            </Text>
          ) : null}
        </Stack>
      </HStack>
    </Box>
  );
};

export const DocsHomeWidget = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;

  return (
    <ScrollArea h="full" bg="bg" contentProps={{ p: "lg", display: "flex", flexDirection: "column", gap: "md" }}>
      <Stack gap="3xs">
        <Text textStyle="title/S/semibold">Docs</Text>
        <Text textStyle="paragraph/M/regular" color="fg.muted">
          Pick a category to drill in. The breadcrumb trail above mirrors the path.
        </Text>
      </Stack>
      <Stack gap="sm">
        {sections.map((section) => (
          <NavCard
            key={section.id}
            icon={section.icon}
            title={section.label}
            description={section.description}
            onClick={() => void workbench.resources.openResource(sectionResource(section))}
          />
        ))}
      </Stack>
    </ScrollArea>
  );
};

export const SectionWidget = (props: { workbench: WorkbenchCore; resource: ResourceRef | undefined }) => {
  const { workbench, resource } = props;
  const section = findSection(typeof resource?.id === "string" ? resource.id : undefined);

  if (!section) {
    return (
      <Stack h="full" p="lg" gap="sm" bg="bg">
        <Text textStyle="title/S/semibold">Unknown section</Text>
        <Text textStyle="paragraph/M/regular" color="fg.muted">
          Open a category from the docs tree.
        </Text>
      </Stack>
    );
  }

  return (
    <ScrollArea h="full" bg="bg" contentProps={{ p: "lg", display: "flex", flexDirection: "column", gap: "md" }}>
      <Stack gap="3xs">
        <Text textStyle="title/S/semibold">{section.label}</Text>
        <Text textStyle="paragraph/M/regular" color="fg.muted">
          {section.description}
        </Text>
      </Stack>
      <Stack gap="sm">
        {section.pages.map((page) => (
          <NavCard
            key={page.id}
            icon="FileText"
            title={page.label}
            description={page.body}
            onClick={() => void workbench.resources.openResource(pageResource(section, page))}
          />
        ))}
      </Stack>
    </ScrollArea>
  );
};

export const PageWidget = (props: { workbench: WorkbenchCore; resource: ResourceRef | undefined }) => {
  const { workbench, resource } = props;
  const match = findPageBySectionPath(typeof resource?.id === "string" ? resource.id : undefined);
  const body = match?.page.body ?? "Open a page from the docs tree.";

  return (
    <ScrollArea h="full" bg="bg" contentProps={{ p: "lg", display: "flex", flexDirection: "column", gap: "md" }}>
      <Stack gap="3xs">
        <Text textStyle="title/S/semibold">{resource?.label ?? "Docs"}</Text>
        <Text textStyle="paragraph/M/regular">{body}</Text>
        <Code colorPalette="gray">{resource?.uri ?? "no resource"}</Code>
      </Stack>
      {match ? (
        <HStack gap="xs">
          <Button
            size="xs"
            variant="outline"
            onClick={() => void workbench.resources.openResource(sectionResource(match.section))}
          >
            Back to {match.section.label}
          </Button>
          <Button size="xs" variant="ghost" onClick={() => void workbench.resources.openResource(docsResource)}>
            Docs home
          </Button>
        </HStack>
      ) : null}
    </ScrollArea>
  );
};
