import { Box, Button, HStack, Stack, Text, Textarea } from "@chakra-ui/react";
import { Slider } from "@pstdio/ui";
import { ArrowRight, Pause, Play } from "lucide-react";
import { useState } from "react";
import { EXAMPLE_ICONS } from "../../content/icon-set-content";
import { DEFAULT_SHADER_SCALE, DEFAULT_SHADER_SOURCE, DEFAULT_SHADER_SPEED } from "../../content/shader-demo-content";
import type { ToolShapeKind } from "../../content/tool-shapes";
import { useStoryStyles, useToolDemoStyles } from "../../hooks/use-landing-styles";
import { useShaderPreview } from "../../hooks/use-shader-preview";
import { BlockSymbol } from "../sections/building-blocks";
import { DemoPanel } from "./demo-workbench";
import { ShaderIconPicker } from "./shader-icon-picker";

interface ShaderEditorDemoProps {
  withControls: boolean;
  highlighted?: ToolShapeKind;
}

export const ShaderEditorDemo = (props: ShaderEditorDemoProps) => {
  const { withControls, highlighted } = props;
  const [selectedIcon, setSelectedIcon] = useState(EXAMPLE_ICONS[11]);
  const [source, setSource] = useState(DEFAULT_SHADER_SOURCE);
  const [scale, setScale] = useState(DEFAULT_SHADER_SCALE);
  const [speed, setSpeed] = useState(DEFAULT_SHADER_SPEED);
  const preview = useShaderPreview(
    source,
    withControls ? scale : DEFAULT_SHADER_SCALE,
    withControls ? speed : DEFAULT_SHADER_SPEED,
    selectedIcon.codepoint,
  );
  const story = useStoryStyles();
  const styles = useToolDemoStyles();

  return (
    <Stack gap="panel-gap">
      <ShaderIconPicker selected={selectedIcon.id} onSelect={setSelectedIcon} highlighted={highlighted} />
      <HStack gap="sm" px="md" py="sm" flexWrap="wrap" textStyle="label/S/regular" aria-label="Connected tools">
        <BlockSymbol kind="editor" />
        <Text>Icon set</Text>
        <ArrowRight size={14} />
        <Text textStyle="mono/XS">{selectedIcon.name}</Text>
        <ArrowRight size={14} />
        <BlockSymbol kind="page" />
        <Text>Shader preview</Text>
      </HStack>
      <Box css={story.panels}>
        <DemoPanel title="waves.frag" kind="editor" highlighted={highlighted}>
          <Textarea
            css={styles.shaderCode}
            aria-label="Fragment shader code"
            wrap="off"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            value={source}
            onChange={(event) => setSource(event.target.value)}
          />
          {preview.error && (
            <Text textStyle="mono/XS" color="fg.error" role="alert">
              {preview.error}
            </Text>
          )}
          <Button
            variant="ghost"
            alignSelf="start"
            onClick={() => setSource(DEFAULT_SHADER_SOURCE)}
            disabled={source === DEFAULT_SHADER_SOURCE}
          >
            Reset code
          </Button>
        </DemoPanel>
        <DemoPanel title="Preview" kind="page" highlighted={highlighted}>
          <Box
            as="canvas"
            css={styles.shaderCanvas}
            ref={preview.canvasRef}
            role="img"
            aria-label="Live shader preview"
          />
          <HStack justify="flex-end">
            <Button variant="outline" onClick={preview.toggle}>
              {preview.playing ? <Pause /> : <Play />}
              {preview.playing ? "Pause preview" : "Play preview"}
            </Button>
          </HStack>
          {withControls && (
            <Stack gap="lg">
              <Stack gap="sm">
                <HStack css={styles.toolbar} textStyle="label/S/regular">
                  <Text>Scale</Text>
                  <Text as="output">{scale}</Text>
                </HStack>
                <Slider
                  aria-label={["Shader scale"]}
                  min={4}
                  max={36}
                  step={1}
                  value={[scale]}
                  onValueChange={({ value }) => setScale(value[0])}
                />
              </Stack>
              <Stack gap="sm">
                <HStack css={styles.toolbar} textStyle="label/S/regular">
                  <Text>Speed</Text>
                  <Text as="output">{speed.toFixed(1)}×</Text>
                </HStack>
                <Slider
                  aria-label={["Shader speed"]}
                  min={0}
                  max={2}
                  step={0.1}
                  value={[speed]}
                  onValueChange={({ value }) => setSpeed(value[0])}
                />
              </Stack>
            </Stack>
          )}
        </DemoPanel>
      </Box>
    </Stack>
  );
};
