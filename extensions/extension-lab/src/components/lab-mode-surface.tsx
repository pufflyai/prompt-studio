import { Badge, Container, Heading, Stack, Text } from "@chakra-ui/react";

interface LabModeSurfaceProps {
  eyebrow: string;
  title: string;
  description: string;
  details: string[];
  colorPalette?: string;
}

export const LabModeSurface = (props: LabModeSurfaceProps) => {
  const { eyebrow, title, description, details, colorPalette = "purple" } = props;

  return (
    <Container as="main" h="full" maxW="3xl" paddingX="lg" paddingY="lg">
      <Stack gap="lg">
        <Stack gap="xs">
          <Badge alignSelf="flex-start" colorPalette={colorPalette} variant="subtle">
            {eyebrow}
          </Badge>
          <Heading as="h1" textStyle="heading/M/bold">
            {title}
          </Heading>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {description}
          </Text>
        </Stack>
        <Stack gap="sm">
          {details.map((detail) => (
            <Text key={detail} textStyle="paragraph/S/regular">
              {detail}
            </Text>
          ))}
        </Stack>
      </Stack>
    </Container>
  );
};
