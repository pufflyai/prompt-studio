import { Box, Button, HStack, Stack, Text, Textarea } from "@chakra-ui/react";
import { ScrollArea, Slider } from "@pstdio/ui";
import { useState } from "react";
import type { ToolShapeKind } from "../../content/tool-shapes";
import { useDemoCli } from "../../hooks/use-demo-cli";
import { DemoContribution } from "../../hooks/use-demo-composition";
import { useStoryStyles, useToolDemoStyles } from "../../hooks/use-landing-styles";
import { useShaderPreview } from "../../hooks/use-shader-preview";
import { DemoPanel } from "./demo-workbench";

interface ShaderEditorDemoProps {
  shader: { filename: string; source: string; scale: number; speed: number; maxSpeed: number };
  iconCodepoint?: string;
  withControls: boolean;
  highlighted?: ToolShapeKind;
}

export const ShaderEditorDemo = (props: ShaderEditorDemoProps) => {
  const { shader, iconCodepoint, withControls, highlighted } = props;
  const [source, setSource] = useState(shader.source);
  const [scale, setScale] = useState(shader.scale);
  const [speed, setSpeed] = useState(shader.speed);
  const hostRef = useDemoCli("shaders", (command) => {
    setScale(command.scale);
    setSpeed(command.speed);
  });
  const preview = useShaderPreview(
    source,
    withControls ? scale : shader.scale,
    withControls ? speed : shader.speed,
    iconCodepoint,
  );
  const story = useStoryStyles();
  const styles = useToolDemoStyles();

  return (
    <Box ref={hostRef} css={[story.panels, styles.shaderPanels]}>
      <DemoPanel title={shader.filename} kind="editor" highlighted={highlighted}>
        <ScrollArea css={styles.shaderScroll} showHorizontalScrollbar>
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
        </ScrollArea>
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
          <DemoContribution kind="hook">
            <Stack css={styles.shaderControls} data-demo-part="hook">
              <Stack css={styles.shaderControl}>
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
              <Stack css={styles.shaderControl}>
                <HStack css={styles.toolbar} textStyle="label/S/regular">
                  <Text>Speed</Text>
                  <Text as="output">{speed.toFixed(1)}×</Text>
                </HStack>
                <Slider
                  aria-label={["Shader speed"]}
                  min={0}
                  max={shader.maxSpeed}
                  step={0.1}
                  value={[speed]}
                  onValueChange={({ value }) => setSpeed(value[0])}
                />
              </Stack>
            </Stack>
          </DemoContribution>
        )}
        <Box
          as="canvas"
          css={styles.shaderCanvas}
          ref={preview.canvasRef}
          role="img"
          aria-label="Live shader preview"
        />
      </DemoPanel>
    </Box>
  );
};
