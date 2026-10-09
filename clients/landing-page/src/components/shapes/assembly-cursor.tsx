import { Box, chakra, Text, useSlotRecipe } from "@chakra-ui/react";
import { CURSOR_CHAT_HEIGHT, CURSOR_CHAT_WIDTH } from "../../content/demo-cli-commands";
import type { Point } from "../../services/shapes/assembly-motion";
import { landingAssemblySlotRecipe } from "../../theme/recipes/landing-assembly";

interface AssemblyCursorProps {
  name: string;
  index: number;
  point: Point;
  mode?: "pointer" | "grabbing" | "text" | "chat";
  command?: string;
  result?: string;
}

export const AssemblyCursor = (props: AssemblyCursorProps) => {
  const { name, index, point, mode = "pointer", command = "", result = "" } = props;
  const styles = useSlotRecipe({ recipe: landingAssemblySlotRecipe })({});
  return (
    <g
      data-assembly-cursor={index}
      data-cursor-name={name}
      data-cursor-mode={mode}
      transform={`translate(${point.x} ${point.y})`}
      pointerEvents="none"
    >
      <g data-cursor-tip="">
        <chakra.path
          css={styles.cursor}
          data-agent={index}
          data-cursor-icon="pointer"
          d="M1.4.3C.5-.2-.3.6.1 1.5l7.8 23.1c.4 1.1 1.9 1.2 2.4.1l4.2-9.1 9.3-3.1c1.1-.4 1.3-1.9.2-2.5Z"
        />
        <chakra.path
          css={styles.cursor}
          data-agent={index}
          data-cursor-icon="grabbing"
          d="M7 10V7a2 2 0 0 1 4 0V5a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v2a2 2 0 0 1 4 0v8c0 5-3 8-8 8h-1c-3 0-5-1-7-4l-5-7a2.4 2.4 0 0 1 3.5-3.2L7 12Z"
        />
        <chakra.path
          css={styles.cursor}
          data-agent={index}
          data-cursor-icon="text"
          d="M5 2h4l3 3 3-3h4v3h-3l-2 2v11l2 2h3v3h-4l-3-3-3 3H5v-3h3l2-2V7L8 5H5Z"
        />
      </g>
      <g data-cursor-label="">
        <chakra.rect css={styles.cursorNameplate} x="18" y="26" width={name.length * 7 + 18} height="22" rx="6" />
        <chakra.text css={styles.cursorName} x="27" y="41">
          {name}
        </chakra.text>
      </g>
      <g data-cursor-chat="" transform="translate(12 0)">
        <foreignObject width={CURSOR_CHAT_WIDTH} height={CURSOR_CHAT_HEIGHT}>
          <Box css={styles.cursorChat} data-agent={index}>
            <Text css={styles.chatName}>{name}</Text>
            <Text as="code" css={styles.chatCommand} data-cursor-command="">
              {command}
            </Text>
            <Text css={styles.chatResult} data-cursor-result="" aria-label={result || undefined}>
              {result ? "✓" : ""}
            </Text>
          </Box>
        </foreignObject>
      </g>
    </g>
  );
};
