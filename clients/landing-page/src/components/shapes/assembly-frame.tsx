import { Box, chakra, useSlotRecipe } from "@chakra-ui/react";
import { BOARD_PREVIEW_HEIGHT, BOARD_WIDTH } from "../../services/shapes/assembly-layout";
import { landingAssemblySlotRecipe } from "../../theme/recipes/landing-assembly";

/** Static geometry keeps the editor visible while the interactive scene loads. */
export const AssemblyFrame = () => {
  const styles = useSlotRecipe({ recipe: landingAssemblySlotRecipe })({});
  return (
    <Box css={styles.frame} data-assembly-frame="" aria-hidden="true">
      <chakra.svg css={styles.framePreview} viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_PREVIEW_HEIGHT}`}>
        <chakra.path css={styles.divider} d={`M0 38H${BOARD_WIDTH}`} />
        {[16, 26, 36].map((cx) => (
          <chakra.circle key={cx} css={styles.chrome} cx={cx} cy="19" r="3" />
        ))}
      </chakra.svg>
      <Box css={styles.frameTray} />
    </Box>
  );
};
