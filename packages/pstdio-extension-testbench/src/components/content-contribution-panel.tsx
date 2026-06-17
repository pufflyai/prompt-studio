import { Box, Button, SimpleGrid, Text } from "@chakra-ui/react";
import { useThemePreference } from "@pstdio/ui";
import { text } from "pstdio-extensions/workbench";
import type { WorkbenchCore } from "pstdio-workbench/core";
import type {
  ExtensionBenchFileIconThemeContribution,
  ExtensionBenchLoadResponse,
  ExtensionBenchSkillContribution,
  ExtensionBenchTemplateContribution,
  ExtensionBenchThemeContribution,
} from "../lib/api-contract";

const rendererId = "extension-testbench.content.renderer";

type ContentContributionPanelConfig =
  | { kind: "template"; contribution: ExtensionBenchTemplateContribution }
  | { kind: "skill"; contribution: ExtensionBenchSkillContribution }
  | { kind: "theme"; contribution: ExtensionBenchThemeContribution }
  | { kind: "fileIconTheme"; contribution: ExtensionBenchFileIconThemeContribution };

export const contentContributionWidgetId = (kind: ContentContributionPanelConfig["kind"], id: string) =>
  `extension-testbench.${kind}.${id}`;

const kindLabels = {
  fileIconTheme: "File icon theme",
  skill: "Skill",
  template: "Template",
  theme: "Theme",
} satisfies Record<ContentContributionPanelConfig["kind"], string>;

const ContributionDetail = (props: { label: string; value: string }) => {
  const { label, value } = props;

  return (
    <Box bg="bg" borderColor="border.subtle" borderRadius="sm" borderWidth="1px" minW="0" p="3">
      <Text as="dt" color="fg.muted" fontSize="xs" fontWeight="700" mb="1">
        {label}
      </Text>
      <Text as="dd" fontSize="sm" m="0" overflowWrap="anywhere">
        {value}
      </Text>
    </Box>
  );
};

const contributionDetails = (contribution: ContentContributionPanelConfig["contribution"]) => {
  const details = [{ label: "Contribution", value: contribution.id }];

  if ("type" in contribution) details.push({ label: "Type", value: contribution.type });
  if ("mode" in contribution) details.push({ label: "Mode", value: contribution.mode });
  if ("format" in contribution) details.push({ label: "Format", value: contribution.format });

  details.push({ label: "Source", value: contribution.sourcePath });
  return details;
};

const ThemeActions = (props: { contribution: ExtensionBenchThemeContribution }) => {
  const { contribution } = props;
  const { setThemePreference, themePreference } = useThemePreference();
  const selected = themePreference === contribution.id;

  return (
    <Button
      alignSelf="start"
      size="sm"
      type="button"
      variant={selected ? "primary" : "outline"}
      onClick={() => setThemePreference(contribution.id)}
    >
      {selected ? "Theme selected" : "Select theme"}
    </Button>
  );
};

const ContentContributionPanel = (props: { config: ContentContributionPanelConfig }) => {
  const { config } = props;
  const { contribution } = config;
  const { title } = contribution;

  return (
    <Box as="section" alignContent="start" display="grid" gap="4" h="full" minH="0" overflow="auto" p="6">
      <Box as="header">
        <Text color="fg.muted" fontSize="xs" fontWeight="700" mb="1" textTransform="uppercase">
          {kindLabels[config.kind]}
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
      {config.kind === "theme" ? <ThemeActions contribution={config.contribution} /> : null}
      <SimpleGrid as="dl" columns={{ base: 1, md: 2 }} gap="2" m="0" maxW="760px">
        {contributionDetails(contribution).map((detail) => (
          <ContributionDetail key={detail.label} label={detail.label} value={detail.value} />
        ))}
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

  const configs: ContentContributionPanelConfig[] = [
    ...bench.inventory.templates.map((contribution) => ({ kind: "template" as const, contribution })),
    ...bench.inventory.skills.map((contribution) => ({ kind: "skill" as const, contribution })),
    ...bench.inventory.themes.map((contribution) => ({ kind: "theme" as const, contribution })),
    ...bench.inventory.fileIconThemes.map((contribution) => ({ kind: "fileIconTheme" as const, contribution })),
  ];

  for (const config of configs) {
    workbench.layout.registerWidget({
      id: contentContributionWidgetId(config.kind, config.contribution.id),
      title: text(config.contribution.title, config.contribution.id),
      area: "main",
      rendererId,
      config,
    });
  }
};
