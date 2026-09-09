import { Box, Code, Stack, Tabs, Text } from "@chakra-ui/react";
import { EXAMPLE_ICONS } from "../../content/icon-set-content";
import { DEMO_TOOL_TABS } from "../../content/service-demo-content";
import { DEFAULT_SHADER_SOURCE } from "../../content/shader-demo-content";
import { useStoryStyles } from "../../hooks/use-landing-styles";
import { IconSetPreview } from "../examples/icon-set-preview";

export const NavigationDemo = () => {
  const styles = useStoryStyles();
  return (
    <Box css={styles.panel}>
      <Tabs.Root defaultValue="icons" size="md" lazyMount unmountOnExit>
        <Box css={styles.panelHeader}>
          <Tabs.List aria-label="Example tool navigation" flexWrap="wrap">
            {DEMO_TOOL_TABS.map((tab) => (
              <Tabs.Trigger key={tab.id} value={tab.id}>
                {tab.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Box>
        <Box css={styles.panelBody}>
          <Tabs.Content value="icons" p="0">
            <IconSetPreview icons={EXAMPLE_ICONS.slice(0, 4).map((icon) => ({ ...icon, state: "ready" }))} />
          </Tabs.Content>
          <Tabs.Content value="shader" p="0">
            <Code as="pre" p="md" overflowX="auto">
              {DEFAULT_SHADER_SOURCE}
            </Code>
          </Tabs.Content>
          <Tabs.Content value="formulas" p="0">
            <Stack gap="md" p="md">
              <Text textStyle="heading/S">Compound growth</Text>
              <Text textStyle="heading/L">$16,289</Text>
              <Text color="fg.muted">$10,000 · 5% annual return · 10 years</Text>
            </Stack>
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Box>
  );
};
