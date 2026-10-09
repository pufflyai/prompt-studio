import { Box, SimpleGrid, Spinner, Stack, Text } from "@chakra-ui/react";
import { SimpleCard, SimpleCardBody } from "@pstdio/ui";
import type { ArtifactExample } from "../create-artifact";
import { useArtifactTranslations } from "../translations";

interface ArtifactCreationExamplesProps {
  onCreate: (example: ArtifactExample) => void;
  creating?: ArtifactExample;
}

const ExampleIllustration = (props: { example: ArtifactExample }) => {
  const { example } = props;
  const color = example === "brief" ? "vis.categorical.1" : "vis.categorical.3";
  return (
    <Stack aria-hidden="true" bg="bg.muted" aspectRatio={16 / 10} align="center" justify="center" p="lg">
      {example === "brief" ? (
        <Stack
          gap="xs"
          p="sm"
          borderWidth="1px"
          borderColor={color}
          borderRadius="xs"
          width="var(--chakra-spacing-5xl)"
        >
          <Box bg={color} height="var(--chakra-spacing-xs)" width="full" borderRadius="2xs" />
          <Box bg={color} height="var(--chakra-spacing-2xs)" width="full" borderRadius="2xs" />
          <Box bg={color} height="var(--chakra-spacing-2xs)" width="2/3" borderRadius="2xs" />
          <Box bg={color} height="var(--chakra-spacing-2xs)" width="full" borderRadius="2xs" />
        </Stack>
      ) : (
        <Stack direction="row" gap="xs" align="end" p="sm" borderWidth="1px" borderColor={color} borderRadius="xs">
          {["md", "xl", "3xl", "lg"].map((height) => (
            <Box
              key={height}
              bg={color}
              width="var(--chakra-spacing-sm)"
              height={`var(--chakra-spacing-${height})`}
              borderRadius="2xs"
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
};

export const ArtifactCreationExamples = (props: ArtifactCreationExamplesProps) => {
  const { onCreate, creating } = props;
  const { t } = useArtifactTranslations();
  const examples = [
    {
      id: "brief" as const,
      title: t("library.briefTitle", "Project brief"),
      description: t("library.briefDescription", "Goals, decisions, and next steps"),
    },
    {
      id: "dashboard" as const,
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
      <SimpleGrid columns={{ base: 1, sm: 2 }} gap="md" maxWidth="md">
        {examples.map((example) => (
          <SimpleCard
            asChild
            key={example.id}
            overflow="hidden"
            textAlign="left"
            cursor="pointer"
            focusVisibleRing="outside"
            _hover={{ borderColor: "border" }}
          >
            <button
              type="button"
              aria-label={example.title}
              aria-busy={creating === example.id}
              disabled={!!creating}
              onClick={() => onCreate(example.id)}
            >
              <ExampleIllustration example={example.id} />
              <SimpleCardBody>
                <Stack gap="xs">
                  <Stack direction="row" align="center" gap="xs">
                    <Text textStyle="paragraph/S/medium">{example.title}</Text>
                    {creating === example.id ? <Spinner size="xs" /> : null}
                  </Stack>
                  <Text textStyle="paragraph/XS/regular" color="fg.muted">
                    {example.description}
                  </Text>
                </Stack>
              </SimpleCardBody>
            </button>
          </SimpleCard>
        ))}
      </SimpleGrid>
    </Stack>
  );
};
