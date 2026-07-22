import { Badge, Box, Container, Heading, Stack, Text } from "@chakra-ui/react";
import { createLabView } from "../renderers/lab-view-shell";

const LabSidenav = () => (
  <Container as="aside" h="full" maxW="sm" paddingX="md" paddingY="md">
    <Stack gap="md">
      <Stack gap="xs">
        <Badge alignSelf="flex-start" colorPalette="purple" variant="subtle">
          Mode
        </Badge>
        <Heading as="h1" textStyle="heading/M/bold">
          Extension Lab
        </Heading>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Workbench experiments and diagnostics.
        </Text>
      </Stack>

      {["Layout", "Views", "Commands"].map((label) => (
        <Box key={label} borderWidth="1px" borderColor="border.subtle" padding="md">
          <Text textStyle="label/S/medium">{label}</Text>
        </Box>
      ))}
    </Stack>
  </Container>
);

export default createLabView(() => <LabSidenav />);
