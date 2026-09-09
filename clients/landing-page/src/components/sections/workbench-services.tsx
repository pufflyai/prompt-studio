import { Box, HStack, Icon, Kbd, Stack, Text } from "@chakra-ui/react";
import { WORKBENCH_SERVICES } from "../../content/workbench-services";
import { useStoryStyles } from "../../hooks/use-landing-styles";

export const WorkbenchServices = () => {
  const styles = useStoryStyles();
  return (
    <Box as="section" css={styles.section} aria-labelledby="plumbing-title">
      <Stack gap="sm">
        <Text id="plumbing-title" as="h2" textStyle="heading/M">
          The plumbing, included.
        </Text>
        <Text textStyle="paragraph/M/regular" color="fg.muted">
          Every tool can use the same workbench essentials.
        </Text>
      </Stack>
      <Box>
        {WORKBENCH_SERVICES.map((service) => (
          <Box key={service.name} css={styles.service}>
            <Icon as={service.icon} boxSize="6" color="fg.muted" />
            <Stack gap="sm" minWidth="0">
              <Text as="h3" textStyle="heading/S">
                {service.name}
              </Text>
              <Text textStyle="paragraph/M/regular" color="fg.muted">
                {service.description}
              </Text>
              <HStack gap="sm" flexWrap="wrap">
                <Text textStyle="label/S/regular" color="fg.subtle">
                  {service.example}
                </Text>
                {service.shortcut && <Kbd>⌘ P</Kbd>}
              </HStack>
            </Stack>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
