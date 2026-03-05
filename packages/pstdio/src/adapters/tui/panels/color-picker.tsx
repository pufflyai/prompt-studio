import { Box, Text } from "ink";
import { VALID_COLORS } from "pstdio-db";

const COLS = 5;

interface ColorPickerProps {
  selectedIndex: number;
  width: number;
}

export function ColorPicker({ selectedIndex, width }: ColorPickerProps) {
  const rows: (typeof VALID_COLORS)[number][][] = [];
  for (let i = 0; i < VALID_COLORS.length; i += COLS) {
    rows.push([...VALID_COLORS.slice(i, i + COLS)]);
  }

  return (
    <Box flexDirection="column" width={width} paddingLeft={2}>
      {rows.map((row, rowIdx) => (
        <Box key={rowIdx}>
          {row.map((color, colIdx) => {
            const idx = rowIdx * COLS + colIdx;
            const isSelected = idx === selectedIndex;
            return (
              <Box key={color} width={12}>
                <Text color={isSelected ? "blue" : undefined}>{isSelected ? "❯ " : "  "}</Text>
                <Text bold={isSelected} color={color}>
                  ● {color}
                </Text>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

export const COLOR_COUNT = VALID_COLORS.length;
export const COLOR_COLS = COLS;

export const colorAt = (index: number) => VALID_COLORS[index] ?? VALID_COLORS[0]!;
