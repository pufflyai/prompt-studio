import { Box, Button, Text, VStack } from "@chakra-ui/react";
import type { GlyphView } from "./types";

interface GlyphCardProps {
  glyph: GlyphView;
  family: string;
  selected: boolean;
  onSelect: (glyph: GlyphView) => void;
}

export const GlyphCard = (props: GlyphCardProps) => {
  const { glyph, family, selected, onSelect } = props;
  return (
    <Button
      variant="outline"
      height="8rem"
      minWidth="0"
      padding="sm"
      borderColor={selected ? "border.emphasized" : "border.subtle"}
      background={selected ? "bg.muted" : "bg.panel"}
      onClick={() => onSelect(glyph)}
      aria-label={`${glyph.name}, ${glyph.codepoint}`}
    >
      <VStack gap="2xs" width="full" minWidth="0">
        <Box fontFamily={family} fontSize="3xl" lineHeight="1">
          {String.fromCodePoint(glyph.unicode)}
        </Box>
        <Text textStyle="sm" fontWeight="medium" truncate width="full">
          {glyph.name}
        </Text>
        <Text textStyle="xs" color="fg.muted">
          {glyph.codepoint}
        </Text>
      </VStack>
    </Button>
  );
};
