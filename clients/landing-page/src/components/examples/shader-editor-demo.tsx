import { Box, Button, HStack, Stack, Text, Textarea } from "@chakra-ui/react";
import { Slider } from "@pstdio/ui";
import { Pause, Play } from "lucide-react";
import { useState } from "react";
import type { ToolShapeKind } from "../../content/tool-shapes";
import { useStoryStyles, useToolDemoStyles } from "../../hooks/use-landing-styles";
import { useShaderPreview } from "../../hooks/use-shader-preview";
import { DemoPanel } from "./demo-workbench";

interface ShaderEditorDemoProps {
  shader: { filename: string; source: string; scale: number; speed: number };
  iconCodepoint?: string;
  withControls: boolean;
  highlighted?: ToolShapeKind;
}

export const ShaderEditorDemo = (props: ShaderEditorDemoProps) => {
  const { shader, iconCodepoint, withControls, highlighted } = props;
  const [source, setSource] = useState(shader.source);
  const [scale, setScale] = useState(shader.scale);
  const [speed, setSpeed] = useState(shader.speed);
  const preview = useShaderPreview(
    source,
    withControls ? scale : shader.scale,
    withControls ? speed : shader.speed,
    iconCodepoint,
  );
  const story = useStoryStyles();
  const styles = useToolDemoStyles();

  return (
    <Box css={story.panels}>
      <DemoPanel title={shader.filename} kind="editor" highlighted={highlighted}>
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
          onClick={() => setSource(shader.source)}
          disabled={source === shader.source}
        >
          Reset code
        </Button>
      </DemoPanel>
      <DemoPanel title="Preview" kind="page" highlighted={highlighted}>
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
      </DemoPanel>
    </Box>
  );
};
