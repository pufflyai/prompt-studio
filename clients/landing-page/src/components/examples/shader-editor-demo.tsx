import { Button, chakra, HStack, Stack, Text, Textarea } from "@chakra-ui/react";
import { Slider } from "@pstdio/ui";
import { Pause, Play } from "lucide-react";
import { useState } from "react";
import { DEFAULT_SHADER_SCALE, DEFAULT_SHADER_SOURCE, DEFAULT_SHADER_SPEED } from "../../content/shader-demo-content";
import { useStoryStyles, useToolDemoStyles } from "../../hooks/use-landing-styles";
import { useShaderPreview } from "../../hooks/use-shader-preview";
import { DemoPanel } from "./demo-workbench";

export const ShaderEditorDemo = (props: { withControls: boolean }) => {
  const { withControls } = props;
  const [source, setSource] = useState(DEFAULT_SHADER_SOURCE);
  const [scale, setScale] = useState(DEFAULT_SHADER_SCALE);
  const [speed, setSpeed] = useState(DEFAULT_SHADER_SPEED);
  const preview = useShaderPreview(
    source,
    withControls ? scale : DEFAULT_SHADER_SCALE,
    withControls ? speed : DEFAULT_SHADER_SPEED,
  );
  const story = useStoryStyles();
  const styles = useToolDemoStyles();

  return (
    <chakra.div css={story.panels}>
      <DemoPanel title="waves.frag" kind="editor">
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
      <DemoPanel title="Preview" kind="page">
        <chakra.canvas css={styles.shaderCanvas} ref={preview.canvasRef} role="img" aria-label="Live shader preview" />
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
    </chakra.div>
  );
};
