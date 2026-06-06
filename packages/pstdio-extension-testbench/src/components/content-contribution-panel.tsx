import { Box, SimpleGrid, Text } from "@chakra-ui/react";
import { text } from "pstdio-extensions/workbench";
import type { WorkbenchCore } from "pstdio-workbench/core";
import type {
  ExtensionBenchLoadResponse,
  ExtensionBenchSkillContribution,
  ExtensionBenchTemplateContribution,
} from "../lib/api-contract";

const rendererId = "extension-testbench.content.renderer";

type ContentContributionPanelConfig =
  | { kind: "template"; contribution: ExtensionBenchTemplateContribution }
  | { kind: "skill"; contribution: ExtensionBenchSkillContribution };

export const contentContributionWidgetId = (kind: ContentContributionPanelConfig["kind"], id: string) =>
  `extension-testbench.${kind}.${id}`;

const ContentContributionPanel = (props: { config: ContentContributionPanelConfig }) => {
  const { config } = props;
  const { contribution } = config;
  const { title } = contribution;

  return (
    <Box as="section" alignContent="start" display="grid" gap="4" h="full" minH="0" overflow="auto" p="6">
      <Box as="header">
        <Text color="fg.muted" fontSize="xs" fontWeight="700" mb="1" textTransform="uppercase">
          {config.kind}
        </Text>
        <Text as="h1" fontSize="2xl" fontWeight="600" lineHeight="1.2">
          {text(title, contribution.id)}
        </Text>
      </Box>
      {contribution.description ? (
        <Text color="fg.muted" fontSize="sm" lineHeight="1.5" maxW="760px">
          {text(contribution.description)}
        </Text>
      ) : null}
      <SimpleGrid as="dl" columns={{ base: 1, md: 2 }} gap="2" m="0" maxW="760px">
        <Box bg="bg" borderColor="border.subtle" borderRadius="sm" borderWidth="1px" minW="0" p="3">
          <Text as="dt" color="fg.muted" fontSize="xs" fontWeight="700" mb="1">
            Contribution
          </Text>
          <Text as="dd" fontSize="sm" m="0" overflowWrap="anywhere">
            {contribution.id}
          </Text>
        </Box>
        {"type" in contribution ? (
          <Box bg="bg" borderColor="border.subtle" borderRadius="sm" borderWidth="1px" minW="0" p="3">
            <Text as="dt" color="fg.muted" fontSize="xs" fontWeight="700" mb="1">
              Type
            </Text>
            <Text as="dd" fontSize="sm" m="0">
              {contribution.type}
            </Text>
          </Box>
        ) : null}
        <Box bg="bg" borderColor="border.subtle" borderRadius="sm" borderWidth="1px" minW="0" p="3">
          <Text as="dt" color="fg.muted" fontSize="xs" fontWeight="700" mb="1">
            Source
          </Text>
          <Text as="dd" fontSize="sm" m="0" overflowWrap="anywhere">
            {contribution.sourcePath}
          </Text>
        </Box>
      </SimpleGrid>
    </Box>
  );
};

export const registerContentContributionWidgets = (workbench: WorkbenchCore, bench: ExtensionBenchLoadResponse) => {
  workbench.renderers.registerRenderer({
    id: rendererId,
    render: ({ widget }) => {
      const config = widget.config as ContentContributionPanelConfig;
      return <ContentContributionPanel config={config} />;
    },
  });

  for (const template of bench.inventory.templates) {
    workbench.layout.registerWidget({
      id: contentContributionWidgetId("template", template.id),
      title: text(template.title, template.id),
      area: "main",
      rendererId,
      config: { kind: "template", contribution: template } satisfies ContentContributionPanelConfig,
    });
  }

  for (const skill of bench.inventory.skills) {
    workbench.layout.registerWidget({
      id: contentContributionWidgetId("skill", skill.id),
      title: text(skill.title, skill.id),
      area: "main",
      rendererId,
      config: { kind: "skill", contribution: skill } satisfies ContentContributionPanelConfig,
    });
  }
};
