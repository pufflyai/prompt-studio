import { Box, Button, HStack, Text } from "@chakra-ui/react";
import { Slider } from "@pstdio/ui";
import { useState } from "react";
import type { ToolShapeKind } from "../../content/tool-shapes";
import { useStoryStyles, useToolDemoStyles } from "../../hooks/use-landing-styles";
import { BlockSymbol } from "../sections/building-blocks";
import { DemoPanel } from "./demo-workbench";

export const FontSpecimen = (props: { weight?: number; alphabet?: boolean }) => {
  const { weight = 500, alphabet = false } = props;
  const styles = useToolDemoStyles();
  return (
    <Box asChild css={styles.art}>
      <svg
        viewBox="0 0 360 340"
        data-weight={weight}
        role="img"
        aria-label={alphabet ? "Font glyph set" : "Font specimen: Make it yours"}
      >
        <g fill="currentColor">
          {alphabet ? (
            ["ABCDEFG", "HIJKLMN", "OPQRSTU", "VWXYZ", "0123456789"].map((line, index) => (
              <text key={line} x="8" y={64 + index * 58} data-type="alphabet">
                {line}
              </text>
            ))
          ) : (
            <>
              <text x="8" y="112" data-type="display">
                Aa
              </text>
              <text x="8" y="196" data-type="heading">
                Make it
              </text>
              <text x="8" y="262" data-type="heading">
                yours.
              </text>
              <text x="8" y="320" data-type="label">
                0123456789 &amp; @ ! ?
              </text>
            </>
          )}
        </g>
      </svg>
    </Box>
  );
};

const GlyphCanvas = (props: { glyph: string; weight: number }) => {
  const { glyph, weight } = props;
  const styles = useToolDemoStyles();
  return (
    <Box css={styles.canvas}>
      <Box asChild css={styles.art}>
        <svg viewBox="0 0 320 280" data-weight={weight} role="img" aria-label={`Glyph ${glyph}, weight ${weight}`}>
          <Box asChild css={styles.grid}>
            <g stroke="currentColor" strokeWidth="0.5">
              {Array.from({ length: 11 }, (_, i) => (
                <path key={i} d={`M${i * 32} 0V280 M0 ${i * 32}H320`} />
              ))}
            </g>
          </Box>
          <text x="160" y="232" textAnchor="middle" data-type="glyph" fill="currentColor">
            {glyph}
          </text>
          <Box asChild css={styles.guide}>
            <g fill="currentColor" stroke="currentColor" strokeWidth="1">
              <path d="M24 57H296 M24 232H296 M64 32V256 M256 32V256" fill="none" strokeDasharray="4 4" />
              {[64, 256].flatMap((x) =>
                [57, 232].map((y) => <rect key={`${x}-${y}`} x={x - 3} y={y - 3} width="6" height="6" />),
              )}
              <text x="24" y="20" data-type="metric" stroke="none">
                CAP HEIGHT
              </text>
              <text x="24" y="271" data-type="metric" stroke="none">
                BASELINE
              </text>
            </g>
          </Box>
        </svg>
      </Box>
    </Box>
  );
};

export const FontEditorDemo = (props: { highlighted?: ToolShapeKind }) => {
  const { highlighted } = props;
  const [glyph, setGlyph] = useState("A");
  const [weight, setWeight] = useState(500);
  const [alphabet, setAlphabet] = useState(false);
  const styles = useToolDemoStyles();
  const story = useStoryStyles();
  return (
    <Box css={story.panels}>
      <DemoPanel title="workbench.font" kind="editor" highlighted={highlighted}>
        <Box css={styles.glyphs} role="group" aria-label="Select a glyph">
          {["A", "B", "G", "R"].map((letter) => (
            <Box
              as="button"
              key={letter}
              css={styles.glyph}
              aria-label={`Select glyph ${letter}`}
              aria-pressed={glyph === letter}
              onClick={() => setGlyph(letter)}
            >
              {letter}
            </Box>
          ))}
        </Box>
        <GlyphCanvas glyph={glyph} weight={weight} />
        <HStack css={styles.toolbar} textStyle="label/S/regular" color="fg.muted">
          <Text>Weight</Text>
          <Text>{weight}</Text>
        </HStack>
        <Slider
          aria-label={["Font weight"]}
          min={400}
          max={700}
          step={100}
          value={[weight]}
          onValueChange={({ value }) => setWeight(value[0])}
        />
      </DemoPanel>
      <DemoPanel title="Type specimen" kind="page" highlighted={highlighted}>
        <Box css={styles.specimen}>
          <FontSpecimen weight={weight} alphabet={alphabet} />
        </Box>
        <HStack css={styles.toolbar}>
          <Text textStyle="label/S/regular" color="fg.muted">
            Workbench Sans · {weight}
          </Text>
          <Button variant="outline" aria-pressed={alphabet} onClick={() => setAlphabet(!alphabet)}>
            <BlockSymbol kind="command" />
            {alphabet ? "Show specimen" : "Show glyph set"}
          </Button>
        </HStack>
      </DemoPanel>
    </Box>
  );
};
