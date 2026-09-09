import { Box, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { Switch } from "@pstdio/ui";
import { useState } from "react";
import { DEMO_EXTENSIONS } from "../../content/service-demo-content";
import { useStoryStyles } from "../../hooks/use-landing-styles";

export const ExtensionsDemo = () => {
  const [enabled, setEnabled] = useState(DEMO_EXTENSIONS.map((extension) => extension.id));
  const styles = useStoryStyles();
  return (
    <Box css={styles.panel}>
      <HStack css={styles.panelHeader}>
        <Text flex="1">Installed extensions</Text>
        <Text color="fg.muted">{enabled.length} enabled</Text>
      </HStack>
      <Box css={styles.panelBody}>
        {DEMO_EXTENSIONS.map((extension) => (
          <HStack key={extension.id} gap="md" py="sm">
            <Icon as={extension.icon} boxSize="6" color="fg.muted" />
            <Stack gap="xs" flex="1" minWidth="0">
              <Text textStyle="label/M/medium">{extension.name}</Text>
              <Text textStyle="paragraph/S/regular" color="fg.muted">
                {extension.description}
              </Text>
            </Stack>
            <Switch
              aria-label={`Enable ${extension.name}`}
              checked={enabled.includes(extension.id)}
              onCheckedChange={({ checked }) =>
                setEnabled((current) =>
                  checked ? [...current, extension.id] : current.filter((id) => id !== extension.id),
                )
              }
            />
          </HStack>
        ))}
      </Box>
    </Box>
  );
};
