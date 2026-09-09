import { Box, HStack, Text } from "@chakra-ui/react";
import { SegmentedControl, useThemePreference } from "@pstdio/ui";
import { Palette } from "lucide-react";
import { EXAMPLE_ICONS } from "../../content/icon-set-content";
import { useStoryStyles } from "../../hooks/use-landing-styles";
import { IconSetPreview } from "../examples/icon-set-preview";

export const ThemesDemo = () => {
  const { themePreference, setThemePreference } = useThemePreference();
  const styles = useStoryStyles();
  return (
    <Box css={styles.panel}>
      <HStack css={styles.panelHeader} flexWrap="wrap">
        <Palette size={16} />
        <Text flex="1">Appearance</Text>
        <SegmentedControl
          aria-label="Example theme"
          value={themePreference}
          onValueChange={setThemePreference}
          options={[
            { value: "pstdio-light", label: "Light" },
            { value: "pstdio-dark", label: "Dark" },
          ]}
        />
      </HStack>
      <Box css={styles.panelBody}>
        <IconSetPreview icons={EXAMPLE_ICONS.slice(4, 8).map((icon) => ({ ...icon, state: "ready" }))} />
        <Text textStyle="label/S/regular" color="fg.muted">
          One theme, across your whole workbench.
        </Text>
      </Box>
    </Box>
  );
};
