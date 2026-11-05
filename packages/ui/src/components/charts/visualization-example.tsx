import { Box, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { SimpleCard, SimpleCardBody } from "../primitives/simple-card";
export function VisualizationExample({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SimpleCard>
      <SimpleCardBody>
        <Stack gap="sm">
          <Text textStyle="label/M/medium">{title}</Text>
          <Box h="xs" minW="0">
            {children}
          </Box>
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
}
