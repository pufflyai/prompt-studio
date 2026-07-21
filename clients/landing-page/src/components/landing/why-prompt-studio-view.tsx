import { Box, Image, Link, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import type { WhyFeature } from "./content/why-prompt-studio";
import { WHY_FEATURES, WHY_INTRO, WHY_PILLARS, WHY_QUOTE, WHY_TITLE } from "./content/why-prompt-studio";
import type { LandingView } from "./landing-content";
import { SectionRule } from "./section-rule";

const FeatureCard = (props: { feature: WhyFeature }) => {
  const { feature } = props;

  return (
    <Stack gap="10px">
      <Box borderWidth="1px" borderColor="border.subtle" rounded="sm" overflow="hidden" bg="bg">
        <Image src={feature.image} alt={feature.alt} width="100%" display="block" />
      </Box>
      <Text fontFamily="mono" fontSize="10px" letterSpacing="1.6px" color="fg.subtle" textTransform="uppercase">
        {feature.label}
      </Text>
      <Text textStyle="paragraph/M/regular" color="fg.muted" maxWidth="520px">
        {feature.body}
      </Text>
    </Stack>
  );
};

interface WhyPromptStudioViewProps {
  onNavigate: (view: LandingView) => void;
}

export const WhyPromptStudioView = (props: WhyPromptStudioViewProps) => {
  const { onNavigate } = props;
  const [fitPillar, surfacePillar, controlPillar, agentsPillar] = WHY_PILLARS;

  return (
    <Stack width="100%" gap="34px" pt="48px" pb="56px" px={{ base: "20px", md: "40px" }}>
      <Stack gap="14px" maxWidth="820px">
        <Text as="h1" textStyle="heading/display/M">
          {WHY_TITLE}
        </Text>
        <Text textStyle="paragraph/L/regular" color="fg.muted">
          {WHY_INTRO}
        </Text>
        <Box borderLeftWidth="4px" borderColor="border" pl="16px" py="3">
          <Text fontFamily="body" fontSize="15px" lineHeight="171%" color="fg.muted">
            {WHY_QUOTE}
          </Text>
        </Box>
      </Stack>

      <Stack className="group" gap="18px">
        <SectionRule label="01 / a workbench, not a workflow" />
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={{ base: "18px", lg: "48px" }}>
          {[fitPillar, surfacePillar].map((pillar) => (
            <Stack key={pillar.title} gap="8px">
              <Text fontFamily="body" fontSize="xl" fontWeight="medium" lineHeight="120%">
                {pillar.title}
              </Text>
              <Text textStyle="paragraph/M/regular" color="fg.muted">
                {pillar.body}
              </Text>
            </Stack>
          ))}
        </SimpleGrid>
      </Stack>

      <Stack className="group" gap="18px">
        <SectionRule label="02 / the workbench, up close" />
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={{ base: "34px", lg: "48px" }}>
          {WHY_FEATURES.map((feature) => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </SimpleGrid>
      </Stack>

      <Stack className="group" gap="18px">
        <SectionRule label="03 / your work, your agents" />
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={{ base: "18px", lg: "48px" }}>
          {[controlPillar, agentsPillar].map((pillar) => (
            <Stack key={pillar.title} gap="8px">
              <Text fontFamily="body" fontSize="xl" fontWeight="medium" lineHeight="120%">
                {pillar.title}
              </Text>
              <Text textStyle="paragraph/M/regular" color="fg.muted">
                {pillar.body}
              </Text>
            </Stack>
          ))}
        </SimpleGrid>
      </Stack>

      <Link
        href="/extensions"
        width="fit-content"
        fontFamily="heading"
        fontWeight="medium"
        fontSize="11px"
        color="fg.muted"
        _hover={{ color: "fg" }}
        onClick={(event) => {
          event.preventDefault();
          onNavigate("gallery");
        }}
      >
        Explore extensions ↗
      </Link>
    </Stack>
  );
};
