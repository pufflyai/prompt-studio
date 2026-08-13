import { Badge, Card, Container, Heading, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { useLabHostProps } from "../hooks/host-context";
import { createLabView } from "../renderers/lab-view-shell";

const ArtifactDetail = () => {
  const { resource } = useLabHostProps();
  const metadata = resource?.metadata ?? {};

  return (
    <Container as="main" h="full" maxW="3xl" paddingX="lg" paddingY="lg">
      <Stack gap="lg">
        <Stack gap="xs">
          <Badge alignSelf="flex-start" colorPalette="purple" variant="subtle">
            Glass Lab artifact
          </Badge>
          <Heading as="h1" textStyle="heading/M/bold">
            {resource?.label ?? "Unknown artifact"}
          </Heading>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            Catalog ID: {resource?.id ?? "Unknown"}
          </Text>
        </Stack>
        <SimpleGrid columns={{ base: 1, md: 3 }} gap="md">
          <Stack gap="2xs">
            <Text textStyle="label/XS/medium" color="fg.muted">
              Role
            </Text>
            <Text textStyle="paragraph/S/regular">{String(metadata.role ?? "Unknown")}</Text>
          </Stack>
          <Stack gap="2xs">
            <Text textStyle="label/XS/medium" color="fg.muted">
              Trust signal
            </Text>
            <Text textStyle="paragraph/S/regular">{String(metadata.trustSignal ?? "Unknown")}</Text>
          </Stack>
          <Stack gap="2xs">
            <Text textStyle="label/XS/medium" color="fg.muted">
              Status
            </Text>
            <Text textStyle="paragraph/S/regular">{String(metadata.status ?? "Unknown")}</Text>
          </Stack>
        </SimpleGrid>
        <Card.Root variant="outline">
          <Card.Body gap="md">
            <Stack gap="2xs">
              <Text textStyle="label/XS/medium" color="fg.muted">
                Summary
              </Text>
              <Text textStyle="paragraph/S/regular">
                {String(metadata.summary ?? "No artifact summary captured yet.")}
              </Text>
            </Stack>
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="md">
              <Stack gap="2xs">
                <Text textStyle="label/XS/medium" color="fg.muted">
                  Custody
                </Text>
                <Text textStyle="paragraph/S/regular">{String(metadata.custody ?? "Unknown")}</Text>
              </Stack>
              <Stack gap="2xs">
                <Text textStyle="label/XS/medium" color="fg.muted">
                  Next step
                </Text>
                <Text textStyle="paragraph/S/regular">{String(metadata.nextStep ?? "Unknown")}</Text>
              </Stack>
            </SimpleGrid>
          </Card.Body>
        </Card.Root>
      </Stack>
    </Container>
  );
};

export default createLabView(() => <ArtifactDetail />);
