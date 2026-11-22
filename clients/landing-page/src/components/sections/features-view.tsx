import { Box, chakra, Icon, Stack, Text } from "@chakra-ui/react";
import { WORKBENCH_SERVICES } from "../../content/workbench-services";
import { useStoryStyles } from "../../hooks/use-landing-styles";
import { BuildingBlocks, DocsHint } from "./building-blocks";

export const FeaturesView = () => {
  const styles = useStoryStyles();
  return (
    <Box css={styles.page} data-studio-section="features">
      <Stack css={styles.intro}>
        <Text as="h2" textStyle={{ base: "heading/L", md: "heading/XL" }}>
          What your tools get for free.
        </Text>
        <Text textStyle="paragraph/L/regular" color="fg.muted">
          Every tool your agent builds plugs into the same workbench.
        </Text>
      </Stack>
      <Box as="section" css={styles.section} aria-labelledby="building-blocks-title">
        <Text id="building-blocks-title" as="h3" textStyle="heading/M">
          Building blocks
        </Text>
        <BuildingBlocks />
      </Box>
      <Box as="section" css={styles.section} aria-labelledby="shared-features-title">
        <Text id="shared-features-title" as="h3" textStyle="heading/M">
          Shared by every tool
        </Text>
        <Box css={styles.blockGrid}>
          {WORKBENCH_SERVICES.map((service) => (
            <chakra.a key={service.id} href={service.docs} css={styles.block}>
              <Icon as={service.icon} boxSize="6" color="fg.muted" />
              <Text as="h4" textStyle="heading/S">
                {service.name}
              </Text>
              <Text textStyle="paragraph/M/regular" color="fg.muted">
                {service.description}
              </Text>
              <DocsHint />
            </chakra.a>
          ))}
        </Box>
      </Box>
    </Box>
  );
};
