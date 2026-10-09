import { Button, Stack, Text } from "@chakra-ui/react";
import { createGlyphIcon, Tooltip } from "@pstdio/ui";
import type { ArtifactExample } from "../create-artifact";
import { useArtifactTranslations } from "../translations";

const BriefIcon = createGlyphIcon("document-text-1");
const DashboardIcon = createGlyphIcon("chart-1");

interface ArtifactCreationExamplesProps {
  onCreate: (example: ArtifactExample) => void;
  creating?: ArtifactExample;
}

export const ArtifactCreationExamples = (props: ArtifactCreationExamplesProps) => {
  const { onCreate, creating } = props;
  const { t } = useArtifactTranslations();
  const examples = [
    {
      id: "brief" as const,
      Icon: BriefIcon,
      title: t("library.briefTitle", "Project brief"),
      description: t("library.briefDescription", "Goals, decisions, and next steps"),
    },
    {
      id: "dashboard" as const,
      Icon: DashboardIcon,
      title: t("library.dashboardTitle", "Project dashboard"),
      description: t("library.dashboardDescription", "Progress, open work, and milestones"),
    },
  ];
  return (
    <Stack gap="md">
      <Stack gap="xs">
        <Text textStyle="paragraph/S/medium">{t("library.makeNew", "Make something new")}</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {t(
            "library.creationHint",
            "Choose an example to start an agent session, or ask any session to create and publish an interactive page. It will appear here.",
          )}
        </Text>
      </Stack>
      <Stack direction="row" flexWrap="wrap" gap="sm">
        {examples.map((example) => (
          <Tooltip key={example.id} content={example.description} openDelay={300}>
            <Button
              variant="outline"
              size="sm"
              borderRadius="pill"
              aria-label={example.title}
              aria-busy={creating === example.id}
              disabled={!!creating}
              loading={creating === example.id}
              onClick={() => onCreate(example.id)}
            >
              <example.Icon aria-hidden="true" />
              {example.title}
            </Button>
          </Tooltip>
        ))}
      </Stack>
    </Stack>
  );
};
