import { Box, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { Switch } from "@pstdio/ui";
import { useState } from "react";
import { EXAMPLE_ICONS } from "../../content/icon-set-content";
import { DEMO_EXTENSIONS } from "../../content/service-demo-content";
import { useStoryStyles, useToolDemoStyles } from "../../hooks/use-landing-styles";
import { ExtensionToolPanel } from "./extension-tool-panels";

export const ExtensionsDemo = () => {
  const [enabled, setEnabled] = useState(DEMO_EXTENSIONS.map((extension) => extension.id));
  const [selectedIcon, setSelectedIcon] = useState(EXAMPLE_ICONS[11]);
  const styles = useStoryStyles();
  const toolStyles = useToolDemoStyles();
  return (
    <Stack gap="md">
      <Box css={styles.panel}>
        <HStack css={styles.panelHeader}>
          <Text flex="1">Installed extensions</Text>
          <Text color="fg.muted">{enabled.length} enabled</Text>
        </HStack>
        <Box css={styles.panelBody}>
          {DEMO_EXTENSIONS.map((extension) => (
            <HStack key={extension.id} gap="md" py="sm">
              <Icon as={extension.icon} boxSize="6" color="fg.muted" />
              <Text flex="1" minWidth="0" textStyle="label/M/medium">
                {extension.name}
              </Text>
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
      <Stack gap="sm">
        <Text textStyle="label/S/medium">Your workbench · {enabled.length} panels</Text>
        <Box css={toolStyles.extensionPanels} aria-label="Extension panels">
          {DEMO_EXTENSIONS.filter((extension) => enabled.includes(extension.id)).map((extension) => (
            <ExtensionToolPanel
              key={extension.id}
              extension={extension}
              selectedIcon={selectedIcon}
              onSelectIcon={setSelectedIcon}
            />
          ))}
          {enabled.length === 0 && (
            <Box css={styles.panel} p="xl" justifyContent="center" alignItems="center">
              <Text textStyle="paragraph/M/regular" color="fg.muted">
                Enable an extension to add its panel.
              </Text>
            </Box>
          )}
        </Box>
      </Stack>
    </Stack>
  );
};
