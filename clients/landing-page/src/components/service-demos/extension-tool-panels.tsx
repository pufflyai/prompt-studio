import { Box, Button, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { SessionIndicator } from "@pstdio/ui";
import { Pause, Play } from "lucide-react";
import { EXAMPLE_ICONS, type ExampleIcon } from "../../content/icon-set-content";
import type { DEMO_EXTENSIONS } from "../../content/service-demo-content";
import { DEFAULT_SHADER_SPEED, MATRIX_SHADER_SOURCE } from "../../content/shader-demo-content";
import { useStoryStyles, useToolDemoStyles } from "../../hooks/use-landing-styles";
import { useShaderPreview } from "../../hooks/use-shader-preview";

const PANEL_ICONS = [
  EXAMPLE_ICONS[0],
  EXAMPLE_ICONS[4],
  EXAMPLE_ICONS[5],
  EXAMPLE_ICONS[6],
  EXAMPLE_ICONS[9],
  EXAMPLE_ICONS[11],
];
type DemoExtension = (typeof DEMO_EXTENSIONS)[number];

const ExtensionShaderPanel = (props: { icon: ExampleIcon }) => {
  const { icon } = props;
  const styles = useToolDemoStyles();
  const preview = useShaderPreview(MATRIX_SHADER_SOURCE, 6, DEFAULT_SHADER_SPEED, icon.codepoint);
  return (
    <Stack gap="sm">
      <Box
        as="canvas"
        ref={preview.canvasRef}
        css={styles.shaderCanvas}
        role="img"
        aria-label="Extension shader preview"
      />
      <HStack justify="space-between" flexWrap="wrap" gap="sm">
        <Text textStyle="mono/XS" color="fg.muted">
          {icon.name}
        </Text>
        <Button variant="ghost" size="xs" onClick={preview.toggle}>
          {preview.playing ? <Pause /> : <Play />}
          {preview.playing ? "Pause" : "Play"}
        </Button>
      </HStack>
      {preview.error && (
        <Text role="alert" textStyle="mono/XS" color="fg.error">
          {preview.error}
        </Text>
      )}
    </Stack>
  );
};

const ExtensionAgentPanel = () => (
  <Stack gap="lg">
    <Stack gap="sm">
      <HStack gap="sm">
        <SessionIndicator status="completed" />
        <Text textStyle="label/S/medium">Codex · Done</Text>
      </HStack>
      <Text textStyle="paragraph/S/regular">Connect the icon set to the shader.</Text>
    </Stack>
    <Stack gap="sm">
      <HStack gap="sm">
        <SessionIndicator status="queued" />
        <Text textStyle="label/S/medium">Claude Code · Queued</Text>
      </HStack>
      <Text textStyle="paragraph/S/regular">Add an SVG export command.</Text>
    </Stack>
  </Stack>
);

interface ExtensionToolPanelProps {
  extension: DemoExtension;
  selectedIcon: ExampleIcon;
  onSelectIcon: (icon: ExampleIcon) => void;
}

export const ExtensionToolPanel = (props: ExtensionToolPanelProps) => {
  const { extension, selectedIcon, onSelectIcon } = props;
  const story = useStoryStyles();
  const styles = useToolDemoStyles();
  return (
    <Box css={story.panel} containerType="inline-size" role="region" aria-label={`${extension.name} panel`}>
      <HStack css={story.panelHeader}>
        <Icon as={extension.icon} boxSize="icon-sm" />
        <Text>{extension.name}</Text>
      </HStack>
      <Box css={story.panelBody}>
        {extension.id === "icons" && (
          <Box css={styles.iconPicker} role="group" aria-label="Extension icons">
            {PANEL_ICONS.map((icon) => (
              <Button
                key={icon.id}
                variant="ghost"
                size="lg"
                aria-label={`Use ${icon.name}`}
                aria-pressed={selectedIcon.id === icon.id}
                onClick={() => onSelectIcon(icon)}
              >
                <Box css={styles.tileSymbol}>
                  <icon.icon />
                </Box>
              </Button>
            ))}
          </Box>
        )}
        {extension.id === "shader" && <ExtensionShaderPanel icon={selectedIcon} />}
        {extension.id === "agents" && <ExtensionAgentPanel />}
      </Box>
    </Box>
  );
};
