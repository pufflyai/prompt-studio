import { Box, Flex, Grid, Text } from "@chakra-ui/react";
import type { SceneProps } from "../../kit";
import { motionPresets } from "../../kit";
import { frameAt, LogoMark } from "./logo-mark";
import { type Outcome, RESULT_AT } from "./physics";

const columns: { outcome: Outcome; label: string }[] = [
  { outcome: "loop", label: "Loop" },
  { outcome: "success", label: "Success out" },
  { outcome: "failure", label: "Failure out" },
];

const LogoLoader = (props: SceneProps) => {
  const { time, reducedMotion, variant } = props;
  const frame = (outcome: Outcome) =>
    frameAt(time, {
      outcome,
      resultAt: RESULT_AT,
      drum: variant.values.drum ?? "alternate",
      bounce: variant.values.bounce ?? "lively",
      reducedMotion,
      tempo: motionPresets[variant.preset],
    });
  return (
    <Grid templateColumns="repeat(3, 1fr)" h="full" bg="bg" px="lg" py="xl" gap="lg">
      {columns.map((column) => (
        <Flex key={column.outcome} direction="column" align="center" justify="space-between" gap="lg">
          <Text textStyle="label/XS/regular" color="fg.muted">
            {column.label}
          </Text>
          <Flex flex="1" align="center" justify="center">
            <LogoMark frame={frame(column.outcome)} size={128} />
          </Flex>
          <Flex align="end" gap="lg" h="12">
            {[16, 24, 32].map((size) => (
              <Box key={size} display="flex" flexDirection="column" alignItems="center" gap="xs">
                <LogoMark frame={frame(column.outcome)} size={size} />
                <Text textStyle="label/XS/regular" color="fg.muted">
                  {size}
                </Text>
              </Box>
            ))}
          </Flex>
        </Flex>
      ))}
    </Grid>
  );
};

export default LogoLoader;
